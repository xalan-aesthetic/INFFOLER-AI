package com.example.ui

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.WhatIfRepository
import com.example.data.WhatIfSimulationResult
import com.example.data.local.ConversationEntity
import com.example.data.local.SimulationEntity
import com.example.data.local.WhatIfDatabase
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

private const val TAG = "WhatIfViewModel"

sealed interface SimulationUiState {
    data object Idle : SimulationUiState
    data class Simulating(val question: String) : SimulationUiState
    data class Success(val result: WhatIfSimulationResult) : SimulationUiState
    data class Error(val message: String, val question: String) : SimulationUiState
}

class WhatIfViewModel(application: Application) : AndroidViewModel(application) {

    private val repository: WhatIfRepository by lazy {
        val dao = WhatIfDatabase.getInstance(application).whatIfDao()
        WhatIfRepository(dao)
    }

    val conversations: StateFlow<List<ConversationEntity>> = repository.conversations
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val simulations: StateFlow<List<SimulationEntity>> = repository.simulations
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private val _simulationUiState = MutableStateFlow<SimulationUiState>(SimulationUiState.Idle)
    val simulationUiState: StateFlow<SimulationUiState> = _simulationUiState.asStateFlow()

    private val _whatIfDraft = MutableStateFlow("")
    val whatIfDraft: StateFlow<String> = _whatIfDraft.asStateFlow()

    private var simJob: Job? = null

    fun setWhatIfDraft(text: String) {
        _whatIfDraft.value = text
    }

    fun deleteConversation(conversationId: Long) {
        viewModelScope.launch {
            repository.deleteConversation(conversationId)
        }
    }

    fun runSimulation(question: String) {
        val cleaned = question.trim()
        if (cleaned.isEmpty()) return
        _whatIfDraft.value = cleaned
        simJob?.cancel()
        simJob = viewModelScope.launch {
            _simulationUiState.value = SimulationUiState.Simulating(cleaned)
            try {
                val result = repository.runWhatIfSimulation(cleaned)
                _simulationUiState.value = SimulationUiState.Success(result)
            } catch (e: TimeoutCancellationException) {
                Log.e(TAG, "Simulation timed out", e)
                _simulationUiState.value = SimulationUiState.Error(
                    message = "Simulation timed out after 60 seconds. Try a more focused question.",
                    question = cleaned
                )
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.e(TAG, "Simulation failed", e)
                _simulationUiState.value = SimulationUiState.Error(
                    message = e.localizedMessage ?: "Quantum simulation failed. Please retry.",
                    question = cleaned
                )
            }
        }
    }

    fun openSavedSimulation(entity: SimulationEntity) {
        _whatIfDraft.value = entity.question
        _simulationUiState.value = SimulationUiState.Success(
            WhatIfSimulationResult(
                id = entity.id,
                question = entity.question,
                initialScenario = entity.initialScenario,
                immediateConsequences = entity.immediateConsequences,
                shortTermPossibilities = entity.shortTermPossibilities,
                longTermPossibilities = entity.longTermPossibilities,
                alternativeOutcomes = entity.alternativeOutcomes,
                factsVsSpeculation = entity.factsVsSpeculation,
                createdAt = entity.createdAt
            )
        )
    }

    fun deleteSimulation(id: Long) {
        viewModelScope.launch {
            repository.deleteSimulation(id)
        }
    }

    fun clearAllLocalHistory() {
        simJob?.cancel()
        _simulationUiState.value = SimulationUiState.Idle
        viewModelScope.launch {
            repository.deleteAllHistory()
        }
    }

    fun clearAppCache(onComplete: (freedBytes: Long) -> Unit) {
        viewModelScope.launch {
            val freed = withContext(Dispatchers.IO) {
                repository.clearModelCache()
                val app = getApplication<Application>()
                val targets = listOfNotNull(app.cacheDir, app.codeCacheDir)
                var bytesFreed = 0L
                targets.forEach { dir ->
                    bytesFreed += clearDirectoryContents(dir)
                }
                bytesFreed
            }
            onComplete(freed)
        }
    }

    private fun clearDirectoryContents(dir: File): Long {
        if (!dir.exists()) return 0L
        var freed = 0L
        dir.listFiles()?.forEach { child ->
            freed += if (child.isDirectory) {
                val sub = clearDirectoryContents(child)
                child.delete()
                sub
            } else {
                val len = child.length()
                if (child.delete()) len else 0L
            }
        }
        return freed
    }
}
