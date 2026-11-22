package com.example.ui

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.R
import com.example.data.ai.GeminiResilience
import com.example.data.local.ConversationEntity
import com.example.data.local.MessageEntity
import com.example.data.local.WhatIfDao
import com.example.data.local.WhatIfDatabase
import com.google.firebase.Firebase
import com.google.firebase.ai.GenerativeModel
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.content
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout

private const val TAG = "ChatViewModel"

enum class AiAgentModel(
    val modelId: String,
    val displayName: String,
    val shortLabel: String,
    val badge: String,
    val description: String
) {
    FLASH_3_8(
        modelId = "gemini-3.8-flash",
        displayName = "Gemini 3.8 Flash",
        shortLabel = "3.8 Flash",
        badge = "DEFAULT · BALANCED",
        description = "All-purpose universal answer agent with automatic Flash-Lite fallback."
    ),
    FLASH_LITE_3_5(
        modelId = "gemini-3.5-flash-lite",
        displayName = "Gemini 3.5 Flash-Lite",
        shortLabel = "3.5 Lite",
        badge = "ULTRA-FAST",
        description = "High-availability, low-latency responses for quick facts, summaries & translations."
    ),
    ARGON_4(
        modelId = "gemini-4-argon",
        displayName = "Gemini 4 Argon",
        shortLabel = "4 Argon",
        badge = "DEEP REASONING · BLAZE",
        description = "Maximum reasoning depth for STEM & architecture (falls back to Flash if unavailable)."
    )
}

data class ChatMessage(
    val id: Long = 0L,
    val isFromUser: Boolean,
    val text: String,
    val timestamp: Long = System.currentTimeMillis(),
    val isStreaming: Boolean = false,
    val isError: Boolean = false
)

sealed interface ChatStatus {
    data object Idle : ChatStatus
    data class Loading(val statusLabel: String = "AGENT THINKING…") : ChatStatus
    data class Streaming(val partialText: String, val modelId: String) : ChatStatus
    data class Error(val message: String, val failedPrompt: String) : ChatStatus
}

data class ChatUiState(
    val activeConversationId: Long? = null,
    val selectedModel: AiAgentModel = AiAgentModel.FLASH_3_8,
    val lastResponderModelId: String? = null,
    val messages: List<ChatMessage> = emptyList(),
    val conversations: List<ConversationEntity> = emptyList(),
    val status: ChatStatus = ChatStatus.Idle
) {
    val isGenerating: Boolean
        get() = status is ChatStatus.Loading || status is ChatStatus.Streaming
}

@OptIn(ExperimentalCoroutinesApi::class)
class ChatViewModel(application: Application) : AndroidViewModel(application) {

    private val dao: WhatIfDao by lazy {
        WhatIfDatabase.getInstance(application).whatIfDao()
    }

    private val defaultGreeting: String by lazy {
        application.getString(R.string.chat_greeting)
    }

    // Lazily instantiate and cache each Gemini model by ID on demand.
    private val modelCache = mutableMapOf<String, GenerativeModel>()

    private fun getOrCreateModel(modelId: String): GenerativeModel {
        return modelCache.getOrPut(modelId) {
            Firebase.ai.generativeModel(
                modelName = modelId,
                systemInstruction = content {
                    text(
                        "You are INFFOLER AI, a futuristic artificial intelligence assistant " +
                            "created by Alankrit Pathak (Founder & Creator of INFFOLER AI). " +
                            "Your job is to directly, thoroughly, and accurately answer every question " +
                            "the user asks across general knowledge, science, mathematics, coding, " +
                            "creative writing, language translation, and hypothetical reasoning. " +
                            "Provide clear step-by-step explanations when helpful, concise formatting " +
                            "for mobile readability, and actionable answers without dodging questions."
                    )
                }
            )
        }
    }

    private val activeConversationId = MutableStateFlow<Long?>(null)
    private val selectedModel = MutableStateFlow(AiAgentModel.FLASH_3_8)
    private val lastResponderModelId = MutableStateFlow<String?>(null)
    private val chatStatus = MutableStateFlow<ChatStatus>(ChatStatus.Idle)

    private val persistedMessages = activeConversationId.flatMapLatest { convId ->
        if (convId == null) flowOf(emptyList()) else dao.observeMessages(convId)
    }

    val uiState: StateFlow<ChatUiState> = combine(
        activeConversationId,
        selectedModel,
        lastResponderModelId,
        persistedMessages,
        dao.observeConversations(),
        chatStatus
    ) { values ->
        val convId = values[0] as Long?
        val model = values[1] as AiAgentModel
        val responderId = values[2] as String?
        @Suppress("UNCHECKED_CAST")
        val entities = values[3] as List<MessageEntity>
        @Suppress("UNCHECKED_CAST")
        val conversations = values[4] as List<ConversationEntity>
        val status = values[5] as ChatStatus

        val mappedMessages = entities.map { entity ->
            ChatMessage(
                id = entity.id,
                isFromUser = entity.role == "user",
                text = entity.content,
                timestamp = entity.timestamp,
                isError = entity.isError
            )
        }.toMutableList()

        if (status is ChatStatus.Streaming && status.partialText.isNotEmpty()) {
            mappedMessages.add(
                ChatMessage(
                    id = -1L,
                    isFromUser = false,
                    text = status.partialText,
                    isStreaming = true
                )
            )
        }

        ChatUiState(
            activeConversationId = convId,
            selectedModel = model,
            lastResponderModelId = responderId,
            messages = mappedMessages,
            conversations = conversations,
            status = status
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000L),
        initialValue = ChatUiState()
    )

    private var activeGenerationJob: Job? = null

    fun selectModel(model: AiAgentModel) {
        selectedModel.value = model
        lastResponderModelId.value = null
    }

    fun ensureActiveConversation(greeting: String = defaultGreeting) {
        if (activeConversationId.value != null) return
        viewModelScope.launch {
            val existing = uiState.value.conversations.firstOrNull()
            if (existing != null) {
                activeConversationId.value = existing.id
            } else {
                activeConversationId.value = createConversationInDb(greeting)
            }
        }
    }

    fun startNewChat(
        greeting: String = defaultGreeting,
        initialPrompt: String? = null
    ) {
        activeGenerationJob?.cancel()
        chatStatus.value = ChatStatus.Idle
        viewModelScope.launch {
            val newId = createConversationInDb(greeting)
            activeConversationId.value = newId
            if (!initialPrompt.isNullOrBlank()) {
                sendMessageInternal(newId, initialPrompt.trim())
            }
        }
    }

    fun selectConversation(conversationId: Long) {
        activeGenerationJob?.cancel()
        chatStatus.value = ChatStatus.Idle
        activeConversationId.value = conversationId
    }

    fun sendMessage(prompt: String, greeting: String = defaultGreeting) {
        val cleaned = prompt.trim()
        if (cleaned.isEmpty() || uiState.value.isGenerating) return

        viewModelScope.launch {
            val convId = activeConversationId.value
                ?: createConversationInDb(greeting).also { activeConversationId.value = it }
            sendMessageInternal(convId, cleaned)
        }
    }

    fun retryLastFailedMessage() {
        val errorState = chatStatus.value as? ChatStatus.Error ?: return
        val convId = activeConversationId.value ?: return
        chatStatus.value = ChatStatus.Idle
        viewModelScope.launch {
            val allMessages = dao.getMessagesOnce(convId)
            val priorHistory = if (allMessages.lastOrNull()?.role == "user") {
                allMessages.dropLast(1)
            } else {
                allMessages
            }
            streamGeminiResponse(convId, errorState.failedPrompt, priorHistory)
        }
    }

    fun clearCurrentConversation(greeting: String = defaultGreeting) {
        activeGenerationJob?.cancel()
        chatStatus.value = ChatStatus.Idle
        val convId = activeConversationId.value ?: return
        viewModelScope.launch {
            val now = System.currentTimeMillis()
            dao.clearMessagesForConversation(convId)
            dao.insertMessage(
                MessageEntity(
                    conversationId = convId,
                    role = "model",
                    content = greeting,
                    timestamp = now
                )
            )
            dao.updateConversationMeta(
                id = convId,
                title = "New Exploration",
                preview = greeting,
                updatedAt = now
            )
        }
    }

    fun resetActiveSelectionIfDeleted(deletedId: Long) {
        if (activeConversationId.value == deletedId) {
            activeGenerationJob?.cancel()
            chatStatus.value = ChatStatus.Idle
            activeConversationId.value = null
        }
    }

    fun resetAll() {
        activeGenerationJob?.cancel()
        chatStatus.value = ChatStatus.Idle
        activeConversationId.value = null
        clearModelCache()
    }

    fun clearModelCache() {
        modelCache.clear()
        lastResponderModelId.value = null
    }

    private suspend fun sendMessageInternal(conversationId: Long, prompt: String) {
        val priorHistory = dao.getMessagesOnce(conversationId)
        saveMessageToDb(conversationId, role = "user", text = prompt)
        streamGeminiResponse(conversationId, prompt, priorHistory)
    }

    private fun streamGeminiResponse(
        conversationId: Long,
        prompt: String,
        priorHistory: List<MessageEntity>
    ) {
        activeGenerationJob?.cancel()
        activeGenerationJob = viewModelScope.launch {
            chatStatus.value = ChatStatus.Loading()
            val activeModel = selectedModel.value
            val modelChain = GeminiResilience.fallbackChainFor(activeModel.modelId)
            val sdkHistory = GeminiResilience.sanitizeChatHistory(priorHistory).map { turn ->
                content(role = turn.role) { text(turn.text) }
            }

            try {
                val (responderModelId, finalReply) = GeminiResilience.executeWithRetryAndFallback(
                    modelIds = modelChain,
                    onStatusUpdate = { _, _, _, reason ->
                        chatStatus.value = ChatStatus.Loading(reason)
                    }
                ) { candidateModelId ->
                    val accumulated = StringBuilder()
                    val chat = getOrCreateModel(candidateModelId).startChat(history = sdkHistory)

                    withTimeout(45_000L) {
                        chat.sendMessageStream(prompt).collect { chunk ->
                            val chunkText = chunk.text.orEmpty()
                            if (chunkText.isNotEmpty()) {
                                accumulated.append(chunkText)
                                chatStatus.value = ChatStatus.Streaming(
                                    partialText = accumulated.toString(),
                                    modelId = candidateModelId
                                )
                            }
                        }
                    }

                    val text = accumulated.toString().trim()
                    if (text.isBlank()) {
                        throw IllegalStateException("INFFOLER AI ($candidateModelId) returned an empty response.")
                    }
                    text
                }

                lastResponderModelId.value = responderModelId
                saveMessageToDb(conversationId, role = "model", text = finalReply)
                chatStatus.value = ChatStatus.Idle
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.e(TAG, "Firebase AI chat generation failed after retries & fallback", e)
                val classified = GeminiResilience.classifyError(e)
                chatStatus.value = ChatStatus.Error(
                    message = classified.userMessage,
                    failedPrompt = prompt
                )
            }
        }
    }

    private suspend fun createConversationInDb(greeting: String): Long {
        val now = System.currentTimeMillis()
        val id = dao.insertConversation(
            ConversationEntity(
                title = "New Exploration",
                preview = greeting,
                createdAt = now,
                updatedAt = now
            )
        )
        dao.insertMessage(
            MessageEntity(
                conversationId = id,
                role = "model",
                content = greeting,
                timestamp = now
            )
        )
        return id
    }

    private suspend fun saveMessageToDb(conversationId: Long, role: String, text: String) {
        val now = System.currentTimeMillis()
        dao.insertMessage(
            MessageEntity(
                conversationId = conversationId,
                role = role,
                content = text,
                timestamp = now
            )
        )
        val existingMessages = dao.getMessagesOnce(conversationId)
        val firstUserMessage = existingMessages.firstOrNull { it.role == "user" }?.content
        val derivedTitle = firstUserMessage
            ?.trim()
            ?.replace("\n", " ")
            ?.take(42)
            ?.let { if (firstUserMessage.length > 42) "$it…" else it }
            ?: "New Exploration"
        val preview = text.trim().replace("\n", " ").take(90)
        dao.updateConversationMeta(
            id = conversationId,
            title = derivedTitle,
            preview = preview,
            updatedAt = now
        )
    }
}
