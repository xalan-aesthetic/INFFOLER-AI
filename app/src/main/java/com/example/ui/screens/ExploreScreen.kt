package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.rounded.Calculate
import androidx.compose.material.icons.rounded.Code
import androidx.compose.material.icons.rounded.EditNote
import androidx.compose.material.icons.rounded.Explore
import androidx.compose.material.icons.rounded.Psychology
import androidx.compose.material.icons.rounded.Public
import androidx.compose.material.icons.rounded.Science
import androidx.compose.material.icons.rounded.Translate
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.example.ui.components.GlassCard
import com.example.ui.components.InffolerFooter
import com.example.ui.theme.BrightViolet
import com.example.ui.theme.ElectricBlue
import com.example.ui.theme.ElectricPurple
import com.example.ui.theme.GlassBorder
import com.example.ui.theme.IceWhite
import com.example.ui.theme.LavenderMuted
import com.example.ui.theme.NeonCyan
import com.example.ui.theme.QuantumMagenta
import com.example.ui.theme.QuantumTeal

private data class CapabilityLauncher(
    val id: String,
    val title: String,
    val description: String,
    val starterPrompt: String,
    val icon: ImageVector,
    val accent: Color,
    val launchesWhatIfMode: Boolean = false
)

private val capabilities = listOf(
    CapabilityLauncher(
        id = "cap_knowledge",
        title = "General Knowledge",
        description = "Clear synthesis across history, philosophy, culture & global systems.",
        starterPrompt = "Explain the most fascinating unsolved mystery in modern history and the leading theories behind it.",
        icon = Icons.Rounded.Public,
        accent = NeonCyan
    ),
    CapabilityLauncher(
        id = "cap_science",
        title = "Science Explanations",
        description = "Quantum physics, astrophysics, biology & chemistry broken down intuitively.",
        starterPrompt = "Explain quantum entanglement like I am visualizing it in 3D space, without losing scientific accuracy.",
        icon = Icons.Rounded.Science,
        accent = ElectricPurple
    ),
    CapabilityLauncher(
        id = "cap_math",
        title = "Mathematics",
        description = "Step-by-step equations, proofs, probability & intuitive geometry.",
        starterPrompt = "Walk me through why Euler's identity e^(i*pi) + 1 = 0 connects five fundamental mathematical constants.",
        icon = Icons.Rounded.Calculate,
        accent = ElectricBlue
    ),
    CapabilityLauncher(
        id = "cap_coding",
        title = "Coding Assistance",
        description = "Architecture, debugging, algorithms & clean production snippets.",
        starterPrompt = "Show me a clean algorithm in Kotlin for finding the shortest path in a weighted graph with brief explanations.",
        icon = Icons.Rounded.Code,
        accent = QuantumTeal
    ),
    CapabilityLauncher(
        id = "cap_creative",
        title = "Creative Writing",
        description = "Sci-fi worldbuilding, dialogue, scripts & vivid storytelling.",
        starterPrompt = "Write a gripping 200-word opening scene set inside an orbital AI research station orbiting Saturn.",
        icon = Icons.Rounded.EditNote,
        accent = QuantumMagenta
    ),
    CapabilityLauncher(
        id = "cap_translate",
        title = "Language Translation",
        description = "Natural, nuance-preserving translation across global languages.",
        starterPrompt = "Translate 'Your imagination starts here. Ask anything, explore everything.' into Japanese, Spanish, and French with pronunciation tips.",
        icon = Icons.Rounded.Translate,
        accent = BrightViolet
    ),
    CapabilityLauncher(
        id = "cap_what_if",
        title = "Hypothetical Simulations",
        description = "Launch the 6-stage timeline engine to model alternate realities.",
        starterPrompt = "What if Earth's gravity suddenly dropped by 30%?",
        icon = Icons.Rounded.Psychology,
        accent = NeonCyan,
        launchesWhatIfMode = true
    )
)

@Composable
fun ExploreScreen(
    onLaunchChatPrompt: (String) -> Unit,
    onLaunchWhatIfSimulation: (String) -> Unit,
    onOpenCreatorProfile: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.TopCenter
    ) {
        LazyVerticalGrid(
            columns = GridCells.Adaptive(minSize = 260.dp),
            contentPadding = PaddingValues(horizontal = 18.dp, vertical = 14.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier
                .fillMaxSize()
                .widthIn(max = 840.dp)
        ) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                Column(modifier = Modifier.padding(bottom = 6.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(
                                    Brush.linearGradient(listOf(ElectricBlue, ElectricPurple))
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Explore,
                                contentDescription = null,
                                tint = IceWhite
                            )
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = "EXPLORE CAPABILITIES",
                                style = MaterialTheme.typography.headlineMedium,
                                color = IceWhite
                            )
                            Text(
                                text = "TAP ANY MODULE TO LAUNCH A LIVE SESSION",
                                style = MaterialTheme.typography.labelSmall,
                                color = NeonCyan
                            )
                        }
                    }
                }
            }

            items(capabilities, key = { it.id }) { cap ->
                GlassCard(
                    borderBrush = Brush.linearGradient(
                        listOf(cap.accent.copy(alpha = 0.55f), GlassBorder)
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag(cap.id)
                        .clickable {
                            if (cap.launchesWhatIfMode) {
                                onLaunchWhatIfSimulation(cap.starterPrompt)
                            } else {
                                onLaunchChatPrompt(cap.starterPrompt)
                            }
                        }
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(40.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(cap.accent.copy(alpha = 0.16f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = cap.icon,
                                    contentDescription = null,
                                    tint = cap.accent
                                )
                            }
                            Icon(
                                imageVector = Icons.AutoMirrored.Rounded.ArrowForward,
                                contentDescription = null,
                                tint = cap.accent
                            )
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = cap.title,
                            style = MaterialTheme.typography.titleLarge,
                            color = IceWhite
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = cap.description,
                            style = MaterialTheme.typography.bodyMedium,
                            color = LavenderMuted
                        )
                        Spacer(modifier = Modifier.height(10.dp))
                        Text(
                            text = if (cap.launchesWhatIfMode) "OPEN SIMULATOR →" else "TRY PROMPT →",
                            style = MaterialTheme.typography.labelSmall,
                            color = cap.accent
                        )
                    }
                }
            }

            item(span = { GridItemSpan(maxLineSpan) }) {
                InffolerFooter(
                    onOpenCreatorProfile = onOpenCreatorProfile,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }
        }
    }
}
