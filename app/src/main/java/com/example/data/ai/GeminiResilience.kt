package com.example.data.ai

import com.example.data.local.MessageEntity
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.delay

enum class AiErrorKind {
    HIGH_DEMAND_OR_SERVER,
    RATE_LIMIT_OR_QUOTA,
    TIMEOUT,
    AUTH_OR_APP_CHECK,
    INVALID_REQUEST,
    UNKNOWN
}

data class ClassifiedAiError(
    val kind: AiErrorKind,
    val retryable: Boolean,
    val allowsModelFallback: Boolean,
    val userMessage: String
)

data class ChatTurn(
    val role: String, // "user" or "model"
    val text: String
)

object GeminiResilience {

    val DEFAULT_BACKOFF_MS = longArrayOf(900L, 2_000L)

    fun fallbackChainFor(primaryModelId: String): List<String> = when (primaryModelId) {
        "gemini-2.5-pro" -> listOf("gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite")
        "gemini-2.5-flash" -> listOf("gemini-2.5-flash", "gemini-2.5-flash-lite")
        "gemini-2.5-flash-lite" -> listOf("gemini-2.5-flash-lite", "gemini-2.5-flash")
        else -> listOf(primaryModelId, "gemini-2.5-flash", "gemini-2.5-flash-lite").distinct()
    }

    fun classifyError(throwable: Throwable): ClassifiedAiError {
        if (throwable is TimeoutCancellationException) {
            return ClassifiedAiError(
                kind = AiErrorKind.TIMEOUT,
                retryable = true,
                allowsModelFallback = true,
                userMessage = "The AI response timed out. Please try again."
            )
        }

        val combinedText = buildString {
            var current: Throwable? = throwable
            var depth = 0
            while (current != null && depth < 5) {
                append(current::class.simpleName.orEmpty()).append(' ')
                append(current.message.orEmpty()).append(' ')
                current = current.cause
                depth++
            }
        }.lowercase()

        return when {
            combinedText.contains("quota") ||
                combinedText.contains("rate limit") ||
                combinedText.contains("rate_limit") ||
                combinedText.contains("resource_exhausted") ||
                combinedText.contains("429") -> {
                ClassifiedAiError(
                    kind = AiErrorKind.RATE_LIMIT_OR_QUOTA,
                    retryable = true,
                    allowsModelFallback = true,
                    userMessage = "AI quota or rate limit temporarily reached. Please wait a moment and tap Retry."
                )
            }

            combinedText.contains("high demand") ||
                combinedText.contains("overloaded") ||
                combinedText.contains("temporarily unavailable") ||
                combinedText.contains("service unavailable") ||
                combinedText.contains("unavailable") ||
                combinedText.contains("503") ||
                combinedText.contains("502") ||
                combinedText.contains("504") ||
                combinedText.contains("500") ||
                combinedText.contains("internal error") -> {
                ClassifiedAiError(
                    kind = AiErrorKind.HIGH_DEMAND_OR_SERVER,
                    retryable = true,
                    allowsModelFallback = true,
                    userMessage = "AI servers are experiencing temporary high demand. Please tap Retry in a moment."
                )
            }

            combinedText.contains("403") ||
                combinedText.contains("401") ||
                combinedText.contains("app check") ||
                combinedText.contains("appcheck") ||
                combinedText.contains("permission_denied") ||
                combinedText.contains("unauthenticated") ||
                combinedText.contains("billing") -> {
                ClassifiedAiError(
                    kind = AiErrorKind.AUTH_OR_APP_CHECK,
                    retryable = false,
                    allowsModelFallback = true,
                    userMessage = throwable.localizedMessage
                        ?: "Model access denied or requires Firebase project verification."
                )
            }

            combinedText.contains("400") ||
                combinedText.contains("invalid_argument") ||
                combinedText.contains("not found") ||
                combinedText.contains("404") -> {
                ClassifiedAiError(
                    kind = AiErrorKind.INVALID_REQUEST,
                    retryable = false,
                    allowsModelFallback = true,
                    userMessage = throwable.localizedMessage ?: "Invalid request for the selected AI model."
                )
            }

            else -> {
                ClassifiedAiError(
                    kind = AiErrorKind.UNKNOWN,
                    retryable = true,
                    allowsModelFallback = true,
                    userMessage = throwable.localizedMessage
                        ?: "Unable to reach WHAT IF AI right now. Check your internet connection."
                )
            }
        }
    }

    /**
     * Executes [block] across [modelIds] with exponential backoff retries per model for
     * transient server, high-demand, and rate-limit errors.
     */
    suspend fun <T> executeWithRetryAndFallback(
        modelIds: List<String>,
        backoffDelaysMs: LongArray = DEFAULT_BACKOFF_MS,
        delayFn: suspend (Long) -> Unit = { delay(it) },
        onStatusUpdate: (modelId: String, attempt: Int, isFallback: Boolean, reason: String) -> Unit = { _, _, _, _ -> },
        block: suspend (modelId: String) -> T
    ): Pair<String, T> {
        var lastException: Throwable? = null

        modelIds.forEachIndexed { modelIndex, modelId ->
            val isFallback = modelIndex > 0
            val maxAttemptsForModel = if (isFallback) 2 else backoffDelaysMs.size + 1

            for (attempt in 1..maxAttemptsForModel) {
                if (attempt > 1 || isFallback) {
                    val statusReason = if (isFallback && attempt == 1) {
                        "Switching to fallback model ($modelId)…"
                    } else {
                        "High demand · retrying ($attempt/$maxAttemptsForModel)…"
                    }
                    onStatusUpdate(modelId, attempt, isFallback, statusReason)
                }

                try {
                    val result = block(modelId)
                    return modelId to result
                } catch (e: TimeoutCancellationException) {
                    lastException = e
                    val delayIndex = attempt - 1
                    if (attempt < maxAttemptsForModel && delayIndex < backoffDelaysMs.size) {
                        delayFn(backoffDelaysMs[delayIndex])
                    } else {
                        break
                    }
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    lastException = e
                    val classified = classifyError(e)
                    val delayIndex = attempt - 1
                    if (classified.retryable && attempt < maxAttemptsForModel && delayIndex < backoffDelaysMs.size) {
                        delayFn(backoffDelaysMs[delayIndex])
                    } else if (classified.allowsModelFallback && modelIndex < modelIds.lastIndex) {
                        // Move immediately to the next fallback model
                        break
                    } else if (!classified.retryable && !classified.allowsModelFallback) {
                        throw e
                    } else {
                        break
                    }
                }
            }
        }

        throw lastException ?: IllegalStateException("All AI models are currently unavailable.")
    }

    /**
     * Normalizes persisted messages for Gemini multi-turn chat:
     * - Drops error messages and blank messages
     * - Strips leading 'model' greetings so history starts with 'user'
     * - Collapses adjacent same-role turns to maintain strict user -> model alternation
     * - Drops any trailing 'user' turn so sendMessageStream(prompt) ends cleanly on 'user'
     */
    fun sanitizeChatHistory(priorHistory: List<MessageEntity>, maxTurns: Int = 20): List<ChatTurn> {
        val validMessages = priorHistory
            .filter { !it.isError && it.content.isNotBlank() }
            .takeLast(maxTurns)

        val firstUserIndex = validMessages.indexOfFirst { it.role == "user" }
        if (firstUserIndex == -1) return emptyList()

        val trimmed = validMessages.subList(firstUserIndex, validMessages.size)
        val alternating = mutableListOf<ChatTurn>()
        for (msg in trimmed) {
            val normalizedRole = if (msg.role == "user") "user" else "model"
            val lastRole = alternating.lastOrNull()?.role
            val turn = ChatTurn(role = normalizedRole, text = msg.content)
            if (lastRole != normalizedRole) {
                alternating.add(turn)
            } else if (alternating.isNotEmpty()) {
                alternating[alternating.lastIndex] = turn
            }
        }

        if (alternating.lastOrNull()?.role == "user") {
            alternating.removeAt(alternating.lastIndex)
        }
        return alternating
    }
}
