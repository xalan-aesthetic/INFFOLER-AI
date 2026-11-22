package com.example.ui.screens

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.Forum
import androidx.compose.material.icons.rounded.History
import androidx.compose.material.icons.rounded.Science
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.example.R
import com.example.data.local.ConversationEntity
import com.example.data.local.SimulationEntity
import com.example.ui.components.GlassCard
import com.example.ui.components.InffolerFooter
import com.example.ui.theme.BrightViolet
import com.example.ui.theme.DeepSpaceBlack
import com.example.ui.theme.ElectricPurple
import com.example.ui.theme.GlassBorder
import com.example.ui.theme.GlassPanel
import com.example.ui.theme.IceWhite
import com.example.ui.theme.LavenderMuted
import com.example.ui.theme.NeonCyan
import com.example.ui.theme.QuantumTeal
import java.text.DateFormat
import java.util.Date

@Composable
fun ConversationsScreen(
    conversations: List<ConversationEntity>,
    simulations: List<SimulationEntity>,
    onOpenConversation: (Long) -> Unit,
    onDeleteConversation: (Long) -> Unit,
    onOpenSimulation: (SimulationEntity) -> Unit,
    onDeleteSimulation: (Long) -> Unit,
    onOpenCreatorProfile: () -> Unit,
    modifier: Modifier = Modifier
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val dateFormatter = remember { DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT) }

    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.TopCenter
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .widthIn(max = 720.dp)
                .padding(horizontal = 18.dp, vertical = 14.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Rounded.History,
                    contentDescription = null,
                    tint = NeonCyan,
                    modifier = Modifier.size(28.dp)
                )
                Spacer(modifier = Modifier.width(10.dp))
                Column {
                    Text(
                        text = "MY CONVERSATIONS",
                        style = MaterialTheme.typography.headlineMedium,
                        color = IceWhite
                    )
                    Text(
                        text = "LOCAL NEURAL ARCHIVE",
                        style = MaterialTheme.typography.labelSmall,
                        color = QuantumTeal
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                FilterChip(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    label = { Text("AI Chats (${conversations.size})") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = ElectricPurple,
                        selectedLabelColor = IceWhite,
                        containerColor = GlassPanel,
                        labelColor = LavenderMuted
                    ),
                    modifier = Modifier.testTag("history_tab_chats")
                )
                FilterChip(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    label = { Text("Simulations (${simulations.size})") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = NeonCyan,
                        selectedLabelColor = DeepSpaceBlack,
                        containerColor = GlassPanel,
                        labelColor = LavenderMuted
                    ),
                    modifier = Modifier.testTag("history_tab_simulations")
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            if (selectedTab == 0) {
                if (conversations.isEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        EmptyArchiveCard(
                            icon = Icons.Rounded.Forum,
                            title = "No AI Chats Yet",
                            subtitle = "Tap the glowing brain on the Core screen or start a new chat to begin."
                        )
                        InffolerFooter(onOpenCreatorProfile = onOpenCreatorProfile)
                    }
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(bottom = 20.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(conversations, key = { it.id }) { conv ->
                            GlassCard(
                                shape = RoundedCornerShape(18.dp),
                                borderBrush = Brush.linearGradient(
                                    listOf(ElectricPurple.copy(alpha = 0.5f), GlassBorder)
                                ),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onOpenConversation(conv.id) }
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(14.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        imageVector = Icons.Rounded.Forum,
                                        contentDescription = null,
                                        tint = BrightViolet,
                                        modifier = Modifier.size(22.dp)
                                    )
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = conv.title,
                                            style = MaterialTheme.typography.titleMedium,
                                            color = IceWhite,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        Spacer(modifier = Modifier.height(2.dp))
                                        Text(
                                            text = conv.preview,
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = LavenderMuted,
                                            maxLines = 2,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        Spacer(modifier = Modifier.height(4.dp))
                                        Text(
                                            text = dateFormatter.format(Date(conv.updatedAt)),
                                            style = MaterialTheme.typography.labelSmall,
                                            color = NeonCyan.copy(alpha = 0.8f)
                                        )
                                    }
                                    IconButton(
                                        onClick = { onDeleteConversation(conv.id) },
                                        modifier = Modifier.size(48.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Rounded.DeleteOutline,
                                            contentDescription = stringResource(R.string.delete_cd),
                                            tint = LavenderMuted
                                        )
                                    }
                                }
                            }
                        }

                        item {
                            InffolerFooter(
                                onOpenCreatorProfile = onOpenCreatorProfile,
                                modifier = Modifier.padding(top = 8.dp)
                            )
                        }
                    }
                }
            } else {
                if (simulations.isEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        EmptyArchiveCard(
                            icon = Icons.Rounded.Science,
                            title = "No Saved Simulations",
                            subtitle = "Run any hypothetical question in WHAT IF Mode to archive its 6-stage timeline here."
                        )
                        InffolerFooter(onOpenCreatorProfile = onOpenCreatorProfile)
                    }
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(bottom = 20.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(simulations, key = { it.id }) { sim ->
                            GlassCard(
                                shape = RoundedCornerShape(18.dp),
                                borderBrush = Brush.linearGradient(
                                    listOf(NeonCyan.copy(alpha = 0.55f), GlassBorder)
                                ),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onOpenSimulation(sim) }
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(14.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        imageVector = Icons.Rounded.Science,
                                        contentDescription = null,
                                        tint = NeonCyan,
                                        modifier = Modifier.size(22.dp)
                                    )
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = sim.question,
                                            style = MaterialTheme.typography.titleMedium,
                                            color = IceWhite,
                                            maxLines = 2,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        Spacer(modifier = Modifier.height(2.dp))
                                        Text(
                                            text = sim.initialScenario,
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = LavenderMuted,
                                            maxLines = 2,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        Spacer(modifier = Modifier.height(4.dp))
                                        Text(
                                            text = dateFormatter.format(Date(sim.createdAt)),
                                            style = MaterialTheme.typography.labelSmall,
                                            color = QuantumTeal
                                        )
                                    }
                                    IconButton(
                                        onClick = { onDeleteSimulation(sim.id) },
                                        modifier = Modifier.size(48.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Rounded.DeleteOutline,
                                            contentDescription = stringResource(R.string.delete_cd),
                                            tint = LavenderMuted
                                        )
                                    }
                                }
                            }
                        }

                        item {
                            InffolerFooter(
                                onOpenCreatorProfile = onOpenCreatorProfile,
                                modifier = Modifier.padding(top = 8.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyArchiveCard(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    subtitle: String
) {
    GlassCard(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = NeonCyan,
                modifier = Modifier.size(36.dp)
            )
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = title,
                style = MaterialTheme.typography.titleLarge,
                color = IceWhite
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodyMedium,
                color = LavenderMuted
            )
        }
    }
}
