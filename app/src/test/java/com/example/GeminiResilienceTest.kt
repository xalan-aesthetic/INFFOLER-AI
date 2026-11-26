package com.example

import com.example.data.ai.AiErrorKind
import com.example.data.ai.GeminiResilience
import com.example.data.local.MessageEntity
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GeminiResilienceTest {

    @Test
    fun `retries with exponential backoff on high demand and succeeds on primary model`() = runTest {
        val recordedDelays = mutableListOf<Long>()
        var attempts = 0

        val (usedModel, reply) = GeminiResilience.executeWithRetryAndFallback(
            modelIds = listOf("gemini-2.5-flash", "gemini-2.5-flash-lite"),
            backoffDelaysMs = longArrayOf(500L, 1_500L),
            delayFn = { ms -> recordedDelays.add(ms) }
        ) { modelId ->
            attempts++
            if (attempts < 3) {
                throw RuntimeException("This model is currently experiencing high demand (503)")
            }
            "Answer from $modelId"
        }

        assertEquals("gemini-2.5-flash", usedModel)
        assertEquals("Answer from gemini-2.5-flash", reply)
        assertEquals(listOf(500L, 1_500L), recordedDelays)
        assertEquals(3, attempts)
    }

    @Test
    fun `falls back to secondary model when primary stays overloaded`() = runTest {
        val triedModels = mutableListOf<String>()
        val recordedDelays = mutableListOf<Long>()

        val (usedModel, reply) = GeminiResilience.executeWithRetryAndFallback(
            modelIds = GeminiResilience.fallbackChainFor("gemini-2.5-flash"),
            backoffDelaysMs = longArrayOf(300L, 600L),
            delayFn = { ms -> recordedDelays.add(ms) }
        ) { modelId ->
            triedModels.add(modelId)
            if (modelId == "gemini-2.5-flash") {
                throw RuntimeException("503 Service Unavailable: This model is currently experiencing high demand")
            }
            "Fallback answer from $modelId"
        }

        assertEquals("gemini-2.5-flash-lite", usedModel)
        assertEquals("Fallback answer from gemini-2.5-flash-lite", reply)
        assertEquals(
            listOf("gemini-2.5-flash", "gemini-2.5-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite"),
            triedModels
        )
        assertEquals(listOf(300L, 600L), recordedDelays)
    }

    @Test
    fun `classifies rate limit and quota errors as retryable with fallback`() {
        val quotaError = GeminiResilience.classifyError(
            RuntimeException("429 RESOURCE_EXHAUSTED: Quota exceeded for requests per minute")
        )
        assertEquals(AiErrorKind.RATE_LIMIT_OR_QUOTA, quotaError.kind)
        assertTrue(quotaError.retryable)
        assertTrue(quotaError.allowsModelFallback)

        val highDemandError = GeminiResilience.classifyError(
            RuntimeException("This model is currently experiencing high demand")
        )
        assertEquals(AiErrorKind.HIGH_DEMAND_OR_SERVER, highDemandError.kind)
        assertTrue(highDemandError.retryable)
        assertTrue(highDemandError.allowsModelFallback)

        val authError = GeminiResilience.classifyError(
            RuntimeException("HTTP 403 App Check token invalid")
        )
        assertEquals(AiErrorKind.AUTH_OR_APP_CHECK, authError.kind)
        assertFalse(authError.retryable)
    }

    @Test(expected = CancellationException::class)
    fun `rethrows cooperative coroutine CancellationException immediately`() = runTest {
        GeminiResilience.executeWithRetryAndFallback(
            modelIds = listOf("gemini-2.5-flash", "gemini-2.5-flash-lite")
        ) {
            throw CancellationException("User navigated away")
        }
    }

    @Test
    fun `sanitizes chat history by stripping greeting and trailing user prompt`() {
        val raw = listOf(
            MessageEntity(id = 1, conversationId = 1, role = "model", content = "Hello! I am WHAT IF AI."),
            MessageEntity(id = 2, conversationId = 1, role = "user", content = "What is gravity?"),
            MessageEntity(id = 3, conversationId = 1, role = "model", content = "Gravity is spacetime curvature."),
            MessageEntity(id = 4, conversationId = 1, role = "user", content = "Tell me more")
        )

        val sanitized = GeminiResilience.sanitizeChatHistory(raw)

        assertEquals(2, sanitized.size)
        assertEquals("user", sanitized[0].role)
        assertEquals("What is gravity?", sanitized[0].text)
        assertEquals("model", sanitized[1].role)
        assertEquals("Gravity is spacetime curvature.", sanitized[1].text)
    }
}
