package com.example.data

import android.util.Log
import com.example.data.ai.GeminiResilience
import com.example.data.local.ConversationEntity
import com.example.data.local.SimulationEntity
import com.example.data.local.WhatIfDao
import com.google.firebase.Firebase
import com.google.firebase.ai.GenerativeModel
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.Schema
import com.google.firebase.ai.type.content
import com.google.firebase.ai.type.generationConfig
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withTimeout
import org.json.JSONObject

private const val TAG = "WhatIfRepository"

data class WhatIfSimulationResult(
    val id: Long = 0,
    val question: String,
    val initialScenario: String,
    val immediateConsequences: String,
    val shortTermPossibilities: String,
    val longTermPossibilities: String,
    val alternativeOutcomes: String,
    val factsVsSpeculation: String,
    val createdAt: Long = System.currentTimeMillis()
)

class WhatIfRepository(private val dao: WhatIfDao) {

    private val simulationSchema by lazy {
        Schema.obj(
            properties = mapOf(
                "initialScenario" to Schema.string(
                    description = "Clear framing of the hypothetical premise and baseline conditions"
                ),
                "immediateConsequences" to Schema.string(
                    description = "What happens in the first seconds, hours, or days"
                ),
                "shortTermPossibilities" to Schema.string(
                    description = "Cascading changes over weeks, months, and the first few years"
                ),
                "longTermPossibilities" to Schema.string(
                    description = "Civilization-scale, evolutionary, or cosmic outcomes over decades to centuries"
                ),
                "alternativeOutcomes" to Schema.string(
                    description = "Branching edge cases, best-case vs worst-case trajectories"
                ),
                "factsVsSpeculation" to Schema.string(
                    description = "Clear distinction between established scientific laws and imaginative speculation"
                )
            )
        )
    }

    private val simulationModels = mutableMapOf<String, GenerativeModel>()

    private fun getOrCreateSimulationModel(modelId: String): GenerativeModel {
        return simulationModels.getOrPut(modelId) {
            Firebase.ai.generativeModel(
                modelName = modelId,
                generationConfig = generationConfig {
                    responseMimeType = "application/json"
                    responseSchema = simulationSchema
                },
                systemInstruction = content {
                    text(
                        "You are the WHAT IF Quantum Simulation Engine inside INFFOLER AI, " +
                            "created by Alankrit Pathak. Analyze hypothetical questions rigorously " +
                            "across physics, biology, society, and technology. Provide vivid, " +
                            "detailed, readable analysis for every requested simulation phase."
                    )
                }
            )
        }
    }

    val conversations: Flow<List<ConversationEntity>> = dao.observeConversations()
    val simulations: Flow<List<SimulationEntity>> = dao.observeSimulations()

    fun clearModelCache() {
        simulationModels.clear()
    }

    suspend fun deleteConversation(conversationId: Long) {
        dao.deleteConversation(conversationId)
    }

    suspend fun deleteAllHistory() {
        dao.deleteAllConversations()
        dao.deleteAllSimulations()
    }

    suspend fun deleteSimulation(id: Long) {
        dao.deleteSimulation(id)
    }

    suspend fun runWhatIfSimulation(question: String): WhatIfSimulationResult {
        try {
            val modelChain = GeminiResilience.fallbackChainFor("gemini-2.5-flash")
            val (_, responseText) = GeminiResilience.executeWithRetryAndFallback(
                modelIds = modelChain
            ) { modelId ->
                val response = withTimeout(45_000L) {
                    getOrCreateSimulationModel(modelId).generateContent(
                        "Run a comprehensive WHAT IF simulation for this hypothetical question: $question"
                    )
                }
                response.text
                    ?: throw IllegalStateException("Simulation engine ($modelId) returned an empty response.")
            }

            val json = JSONObject(responseText)
            val entity = SimulationEntity(
                question = question.trim(),
                initialScenario = json.getString("initialScenario"),
                immediateConsequences = json.getString("immediateConsequences"),
                shortTermPossibilities = json.getString("shortTermPossibilities"),
                longTermPossibilities = json.getString("longTermPossibilities"),
                alternativeOutcomes = json.getString("alternativeOutcomes"),
                factsVsSpeculation = json.getString("factsVsSpeculation")
            )
            val savedId = dao.insertSimulation(entity)
            return entity.toDomain(savedId)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            Log.e(TAG, "Simulation failed after retries & fallback", e)
            throw IllegalStateException(GeminiResilience.classifyError(e).userMessage, e)
        }
    }

    private fun SimulationEntity.toDomain(overrideId: Long = id): WhatIfSimulationResult =
        WhatIfSimulationResult(
            id = overrideId,
            question = question,
            initialScenario = initialScenario,
            immediateConsequences = immediateConsequences,
            shortTermPossibilities = shortTermPossibilities,
            longTermPossibilities = longTermPossibilities,
            alternativeOutcomes = alternativeOutcomes,
            factsVsSpeculation = factsVsSpeculation,
            createdAt = createdAt
        )
}
