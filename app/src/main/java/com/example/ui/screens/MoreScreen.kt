package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.CleaningServices
import androidx.compose.material.icons.rounded.DeleteSweep
import androidx.compose.material.icons.rounded.Explore
import androidx.compose.material.icons.rounded.Forum
import androidx.compose.material.icons.rounded.History
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Psychology
import androidx.compose.material.icons.rounded.Science
import androidx.compose.material.icons.rounded.Verified
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.R
import com.example.ui.components.ConnectWithAlankritSection
import com.example.ui.components.GlassCard
import com.example.ui.components.InffolerFooter
import com.example.ui.theme.BrightViolet
import com.example.ui.theme.ElectricBlue
import com.example.ui.theme.ElectricPurple
import com.example.ui.theme.ErrorCrimson
import com.example.ui.theme.GlassBorder
import com.example.ui.theme.GlassPanelElevated
import com.example.ui.theme.IceWhite
import com.example.ui.theme.LavenderMuted
import com.example.ui.theme.NeonCyan
import com.example.ui.theme.ObsidianVoid
import com.example.ui.theme.QuantumMagenta
import com.example.ui.theme.QuantumTeal

@Composable
fun MoreScreen(
    onOpenCreatorProfile: () -> Unit,
    onOpenChat: () -> Unit,
    onOpenWhatIfMode: () -> Unit,
    onOpenCore: () -> Unit,
    onOpenExplore: () -> Unit,
    onOpenHistory: () -> Unit,
    onClearAppCache: () -> Unit,
    onClearAllLocalData: () -> Unit,
    modifier: Modifier = Modifier
) {
    var showConfirmClearData by remember { mutableStateOf(false) }

    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.TopCenter
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .widthIn(max = 760.dp)
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
                        .background(Brush.linearGradient(listOf(ElectricPurple, NeonCyan))),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Rounded.AutoAwesome,
                        contentDescription = null,
                        tint = ObsidianVoid
                    )
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        text = "INFFOLER STUDIO HUB",
                        style = MaterialTheme.typography.headlineMedium,
                        color = IceWhite
                    )
                    Text(
                        text = "TOOLS, CREATOR IDENTITY & SYSTEM CONTROLS",
                        style = MaterialTheme.typography.labelSmall,
                        color = NeonCyan
                    )
                }
            }

            // Founder Banner Card
            GlassCard(
                shape = RoundedCornerShape(22.dp),
                borderBrush = Brush.linearGradient(
                    listOf(ElectricPurple.copy(alpha = 0.7f), NeonCyan.copy(alpha = 0.65f))
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onOpenCreatorProfile)
                    .testTag("more_creator_profile_card")
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(62.dp)
                            .clip(CircleShape)
                            .border(
                                2.dp,
                                Brush.linearGradient(listOf(ElectricPurple, NeonCyan)),
                                CircleShape
                            )
                    ) {
                        Image(
                            painter = painterResource(R.drawable.creator_avatar),
                            contentDescription = stringResource(R.string.creator_name),
                            contentScale = ContentScale.Crop,
                            modifier = Modifier
                                .fillMaxSize()
                                .scale(1.16f)
                        )
                    }
                    Spacer(modifier = Modifier.width(14.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = stringResource(R.string.creator_name),
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                color = IceWhite
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Icon(
                                imageVector = Icons.Rounded.Verified,
                                contentDescription = "Verified Founder",
                                tint = BrightViolet,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                        Text(
                            text = stringResource(R.string.creator_role),
                            style = MaterialTheme.typography.bodyMedium,
                            color = BrightViolet
                        )
                        Text(
                            text = "Tap to view Creator Profile & Story",
                            style = MaterialTheme.typography.labelSmall,
                            color = NeonCyan
                        )
                    }
                    Icon(
                        imageVector = Icons.AutoMirrored.Rounded.ArrowForward,
                        contentDescription = null,
                        tint = NeonCyan
                    )
                }
            }

            // Workspaces & AI Tools
            Text(
                text = "AI WORKSPACES",
                style = MaterialTheme.typography.labelMedium,
                color = BrightViolet
            )

            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                MoreActionTile(
                    title = "AI Chat Assistant",
                    subtitle = "Live streaming Q&A powered by Gemini",
                    icon = Icons.Rounded.Forum,
                    accent = NeonCyan,
                    testTag = "more_ai_chat",
                    onClick = onOpenChat
                )
                MoreActionTile(
                    title = "WHAT IF Simulator",
                    subtitle = "Explore 6-stage hypothetical realities",
                    icon = Icons.Rounded.Science,
                    accent = ElectricPurple,
                    testTag = "more_what_if",
                    onClick = onOpenWhatIfMode
                )
                MoreActionTile(
                    title = "Core AI Hologram",
                    subtitle = "Interactive 3D neural brain launcher",
                    icon = Icons.Rounded.Psychology,
                    accent = ElectricBlue,
                    testTag = "more_core_ai",
                    onClick = onOpenCore
                )
                MoreActionTile(
                    title = "Explore Capabilities",
                    subtitle = "Launch curated STEM, coding & creative prompts",
                    icon = Icons.Rounded.Explore,
                    accent = QuantumTeal,
                    testTag = "more_explore",
                    onClick = onOpenExplore
                )
                MoreActionTile(
                    title = "Saved History",
                    subtitle = "Revisit past conversations & simulations",
                    icon = Icons.Rounded.History,
                    accent = QuantumMagenta,
                    testTag = "more_history",
                    onClick = onOpenHistory
                )
                MoreActionTile(
                    title = "Founder Profile — Alankrit Pathak",
                    subtitle = "Vision, bio & social hub",
                    icon = Icons.Rounded.Person,
                    accent = BrightViolet,
                    testTag = "more_founder_profile",
                    onClick = onOpenCreatorProfile
                )
            }

            // System & Cache Controls
            Text(
                text = "SYSTEM & CACHE",
                style = MaterialTheme.typography.labelMedium,
                color = QuantumTeal
            )

            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                MoreActionTile(
                    title = "Clear App Cache",
                    subtitle = "Free temporary files and refresh cached AI models",
                    icon = Icons.Rounded.CleaningServices,
                    accent = QuantumTeal,
                    testTag = "more_clear_cache",
                    onClick = onClearAppCache
                )
                MoreActionTile(
                    title = "Clear Local Storage",
                    subtitle = "Delete all locally saved chats and WHAT IF runs",
                    icon = Icons.Rounded.DeleteSweep,
                    accent = ErrorCrimson,
                    testTag = "more_clear_storage",
                    onClick = { showConfirmClearData = true }
                )
            }

            ConnectWithAlankritSection()

            InffolerFooter(onOpenCreatorProfile = onOpenCreatorProfile)

            Spacer(modifier = Modifier.height(10.dp))
        }
    }

    if (showConfirmClearData) {
        AlertDialog(
            onDismissRequest = { showConfirmClearData = false },
            containerColor = ObsidianVoid,
            titleContentColor = IceWhite,
            textContentColor = LavenderMuted,
            title = { Text("Clear Local Storage?") },
            text = { Text("This permanently deletes all saved AI chat threads and WHAT IF simulations on this device.") },
            confirmButton = {
                TextButton(onClick = {
                    showConfirmClearData = false
                    onClearAllLocalData()
                }) {
                    Text("Delete All", color = ErrorCrimson)
                }
            },
            dismissButton = {
                TextButton(onClick = { showConfirmClearData = false }) {
                    Text("Cancel", color = NeonCyan)
                }
            }
        )
    }
}

@Composable
private fun MoreActionTile(
    title: String,
    subtitle: String,
    icon: ImageVector,
    accent: Color,
    testTag: String,
    onClick: () -> Unit
) {
    GlassCard(
        shape = RoundedCornerShape(18.dp),
        borderBrush = Brush.linearGradient(
            listOf(accent.copy(alpha = 0.5f), GlassBorder)
        ),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .testTag(testTag)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = GlassPanelElevated,
                border = BorderStroke(1.dp, accent.copy(alpha = 0.45f)),
                modifier = Modifier.size(44.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = accent,
                        modifier = Modifier.size(22.dp)
                    )
                }
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    color = IceWhite
                )
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.5.sp),
                    color = LavenderMuted
                )
            }
            Icon(
                imageVector = Icons.AutoMirrored.Rounded.ArrowForward,
                contentDescription = null,
                tint = accent
            )
        }
    }
}
