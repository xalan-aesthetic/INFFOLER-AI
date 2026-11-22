package com.example.ui.screens

import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AltRoute
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.Balance
import androidx.compose.material.icons.rounded.Bolt
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.ErrorOutline
import androidx.compose.material.icons.rounded.Forum
import androidx.compose.material.icons.rounded.Public
import androidx.compose.material.icons.rounded.Science
import androidx.compose.material.icons.rounded.Timeline
import androidx.compose.material.icons.rounded.Update
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp
import com.example.R
import com.example.data.WhatIfSimulationResult
import com.example.ui.SimulationUiState
import com.example.ui.components.GlassCard
import com.example.ui.components.InffolerFooter
import com.example.ui.theme.BrightViolet
import com.example.ui.theme.DeepSpaceBlack
import com.example.ui.theme.DeepViolet
import com.example.ui.theme.ElectricBlue
import com.example.ui.theme.ElectricPurple
import com.example.ui.theme.ErrorCrimson
import com.example.ui.theme.GlassBorder
import com.example.ui.theme.GlassPanel
import com.example.ui.theme.IceWhite
import com.example.ui.theme.LavenderMuted
import com.example.ui.theme.NeonCyan
import com.example.ui.theme.QuantumMagenta
import com.example.ui.theme.QuantumTeal

private val sampleHypotheticals = listOf(
    "What if humans could fly?",
    "What if Earth had two moons?",
    "What if the internet disappeared?",
    "What if humans could travel through time?"
)

@Composable
fun WhatIfModeScreen(
    draftQuestion: String,
    uiState: SimulationUiState,
    onDraftChange: (String) -> Unit,
    onRunSimulation: (String) -> Unit,
    onDiscussInChat: (WhatIfSimulationResult) -> Unit,
    onOpenCreatorProfile: () -> Unit,
    modifier: Modifier = Modifier
) {
    val clipboard = LocalClipboardManager.current
    val context = LocalContext.current
    val copiedFeedback = stringResource(R.string.copied_feedback)

    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.TopCenter
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .widthIn(max = 720.dp)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 18.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(42.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(
                            Brush.linearGradient(listOf(QuantumMagenta, ElectricPurple, NeonCyan))
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Science,
                        contentDescription = null,
                        tint = IceWhite,
                        modifier = Modifier.size(24.dp)
                    )
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        text = "WHAT IF MODE",
                        style = MaterialTheme.typography.headlineMedium,
                        color = IceWhite
                    )
                    Text(
                        text = "INFFOLER AI · HYPOTHETICAL SCENARIO LAB",
                        style = MaterialTheme.typography.labelSmall,
                        color = NeonCyan
                    )
                }
            }

            // Input Console Card
            GlassCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Enter a hypothetical premise",
                        style = MaterialTheme.typography.titleMedium,
                        color = IceWhite
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    OutlinedTextField(
                        value = draftQuestion,
                        onValueChange = onDraftChange,
                        placeholder = {
                            Text(
                                text = stringResource(R.string.what_if_input_hint),
                                color = LavenderMuted
                            )
                        },
                        minLines = 2,
                        maxLines = 4,
                        shape = RoundedCornerShape(16.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = DeepSpaceBlack.copy(alpha = 0.6f),
                            unfocusedContainerColor = DeepSpaceBlack.copy(alpha = 0.45f),
                            focusedBorderColor = NeonCyan,
                            unfocusedBorderColor = GlassBorder,
                            focusedTextColor = IceWhite,
                            unfocusedTextColor = IceWhite,
                            cursorColor = NeonCyan
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("what_if_input")
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    // Sample Hypothetical Chips
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        sampleHypotheticals.forEach { sample ->
                            Surface(
                                shape = CircleShape,
                                color = GlassPanel,
                                border = BorderStroke(1.dp, ElectricPurple.copy(alpha = 0.45f)),
                                modifier = Modifier.clickable {
                                    onDraftChange(sample)
                                    onRunSimulation(sample)
                                }
                            ) {
                                Text(
                                    text = sample,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = BrightViolet,
                                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    val isLoading = uiState is SimulationUiState.Simulating
                    Button(
                        onClick = { onRunSimulation(draftQuestion) },
                        enabled = !isLoading && draftQuestion.isNotBlank(),
                        shape = RoundedCornerShape(16.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp)
                            .background(
                                brush = Brush.horizontalGradient(
                                    listOf(DeepViolet, ElectricPurple, NeonCyan)
                                ),
                                shape = RoundedCornerShape(16.dp)
                            )
                            .testTag("simulate_button")
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(
                                color = DeepSpaceBlack,
                                strokeWidth = 2.dp,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(
                                text = "SIMULATING TIMELINE…",
                                style = MaterialTheme.typography.labelLarge,
                                color = DeepSpaceBlack
                            )
                        } else {
                            Icon(
                                imageVector = Icons.Rounded.Bolt,
                                contentDescription = null,
                                tint = DeepSpaceBlack
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = stringResource(R.string.run_simulation),
                                style = MaterialTheme.typography.labelLarge,
                                color = DeepSpaceBlack
                            )
                        }
                    }
                }
            }

            // State Content
            when (uiState) {
                is SimulationUiState.Idle -> {
                    GlassCard(modifier = Modifier.fillMaxWidth()) {
                        Column(
                            modifier = Modifier.padding(20.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.AutoAwesome,
                                contentDescription = null,
                                tint = NeonCyan,
                                modifier = Modifier.size(34.dp)
                            )
                            Spacer(modifier = Modifier.height(10.dp))
                            Text(
                                text = "Ready to Simulate Any Reality",
                                style = MaterialTheme.typography.titleLarge,
                                color = IceWhite
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = "Tap a scenario chip above or type your own 'What if…' question to generate a structured 6-stage scientific & speculative breakdown.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = LavenderMuted
                            )
                        }
                    }
                }

                is SimulationUiState.Simulating -> {
                    SimulationLoadingCard(question = uiState.question)
                }

                is SimulationUiState.Error -> {
                    GlassCard(
                        borderBrush = Brush.linearGradient(
                            listOf(ErrorCrimson, ElectricPurple.copy(alpha = 0.4f))
                        ),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Rounded.ErrorOutline, contentDescription = null, tint = ErrorCrimson)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "Simulation Error",
                                    style = MaterialTheme.typography.titleMedium,
                                    color = ErrorCrimson
                                )
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = uiState.message,
                                style = MaterialTheme.typography.bodyMedium,
                                color = IceWhite
                            )
                        }
                    }
                }

                is SimulationUiState.Success -> {
                    val sim = uiState.result
                    val sections = listOf(
                        Triple("INITIAL SCENARIO", sim.initialScenario, Icons.Rounded.Public to ElectricPurple),
                        Triple("IMMEDIATE CONSEQUENCES", sim.immediateConsequences, Icons.Rounded.Bolt to NeonCyan),
                        Triple("SHORT-TERM POSSIBILITIES", sim.shortTermPossibilities, Icons.Rounded.Update to ElectricBlue),
                        Triple("LONG-TERM POSSIBILITIES", sim.longTermPossibilities, Icons.Rounded.Timeline to BrightViolet),
                        Triple("ALTERNATIVE OUTCOMES", sim.alternativeOutcomes, Icons.Rounded.AltRoute to QuantumMagenta),
                        Triple("SCIENTIFIC FACTS VS. SPECULATION", sim.factsVsSpeculation, Icons.Rounded.Balance to QuantumTeal)
                    )

                    Text(
                        text = "SIMULATION REPORT: ${sim.question.uppercase()}",
                        style = MaterialTheme.typography.labelMedium,
                        color = NeonCyan
                    )

                    sections.forEachIndexed { idx, (label, body, stylePair) ->
                        AnimatedVisibility(
                            visible = true,
                            enter = fadeIn(tween(240 + idx * 60)) + slideInVertically { it / 5 }
                        ) {
                            SimulationPhaseCard(
                                phaseLabel = label,
                                body = body,
                                icon = stylePair.first,
                                accentColor = stylePair.second
                            )
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        OutlinedButton(
                            onClick = {
                                val fullReport = buildString {
                                    appendLine("WHAT IF SIMULATION: ${sim.question}")
                                    appendLine()
                                    sections.forEach { (title, text, _) ->
                                        appendLine("=== $title ===")
                                        appendLine(text)
                                        appendLine()
                                    }
                                }
                                clipboard.setText(AnnotatedString(fullReport))
                                Toast.makeText(context, copiedFeedback, Toast.LENGTH_SHORT).show()
                            },
                            border = BorderStroke(1.dp, NeonCyan.copy(alpha = 0.6f)),
                            modifier = Modifier
                                .weight(1f)
                                .height(48.dp)
                        ) {
                            Icon(Icons.Rounded.ContentCopy, contentDescription = null, tint = NeonCyan, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Copy Report", color = NeonCyan)
                        }

                        Button(
                            onClick = { onDiscussInChat(sim) },
                            colors = ButtonDefaults.buttonColors(containerColor = ElectricPurple),
                            modifier = Modifier
                                .weight(1f)
                                .height(48.dp)
                        ) {
                            Icon(Icons.Rounded.Forum, contentDescription = null, tint = IceWhite, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Discuss in Chat", color = IceWhite)
                        }
                    }
                }
            }

            InffolerFooter(onOpenCreatorProfile = onOpenCreatorProfile)

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@Composable
private fun SimulationPhaseCard(
    phaseLabel: String,
    body: String,
    icon: ImageVector,
    accentColor: Color
) {
    GlassCard(
        borderBrush = Brush.linearGradient(
            listOf(accentColor.copy(alpha = 0.65f), GlassBorder)
        ),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(30.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(accentColor.copy(alpha = 0.16f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = accentColor,
                        modifier = Modifier.size(18.dp)
                    )
                }
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    text = phaseLabel,
                    style = MaterialTheme.typography.labelMedium,
                    color = accentColor
                )
            }
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = body,
                style = MaterialTheme.typography.bodyLarge,
                color = IceWhite
            )
        }
    }
}

@Composable
private fun SimulationLoadingCard(question: String) {
    val transition = rememberInfiniteTransition(label = "sim_loader")
    val pulse by transition.animateFloat(
        initialValue = 0.35f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(800, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "sim_pulse"
    )

    GlassCard(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            CircularProgressIndicator(
                color = NeonCyan.copy(alpha = pulse),
                trackColor = ElectricPurple.copy(alpha = 0.25f),
                strokeWidth = 3.dp,
                modifier = Modifier.size(44.dp)
            )
            Spacer(modifier = Modifier.height(14.dp))
            Text(
                text = "RUNNING QUANTUM SIMULATION…",
                style = MaterialTheme.typography.labelMedium,
                color = NeonCyan
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = question,
                style = MaterialTheme.typography.bodyMedium,
                color = LavenderMuted
            )
        }
    }
}
