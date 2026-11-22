package com.example.ui.screens

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.Bolt
import androidx.compose.material.icons.rounded.CleaningServices
import androidx.compose.material.icons.rounded.DeleteSweep
import androidx.compose.material.icons.rounded.Menu
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Science
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.R
import com.example.ui.components.AiStatusPill
import com.example.ui.components.ConnectWithAlankritSection
import com.example.ui.components.HolographicBrain
import com.example.ui.components.InffolerFooter
import com.example.ui.components.NeonMiniBrainGlyph
import com.example.ui.theme.BrightViolet
import com.example.ui.theme.DeepSpaceBlack
import com.example.ui.theme.DeepViolet
import com.example.ui.theme.ElectricBlue
import com.example.ui.theme.ElectricPurple
import com.example.ui.theme.ErrorCrimson
import com.example.ui.theme.GlassBorder
import com.example.ui.theme.GlassPanel
import com.example.ui.theme.GlassPanelElevated
import com.example.ui.theme.IceWhite
import com.example.ui.theme.LavenderMuted
import com.example.ui.theme.NeonCyan
import com.example.ui.theme.ObsidianVoid
import com.example.ui.theme.QuantumTeal
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CoreScreen(
    onActivateAi: () -> Unit,
    onStartNewChat: () -> Unit,
    onOpenWhatIfMode: () -> Unit,
    onOpenCreatorProfile: () -> Unit,
    onClearAppCache: () -> Unit,
    onClearAllLocalData: () -> Unit,
    modifier: Modifier = Modifier
) {
    var isActivating by remember { mutableStateOf(false) }
    var showMenuSheet by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    val triggerActivation: () -> Unit = {
        if (!isActivating) {
            isActivating = true
            scope.launch {
                delay(560L)
                onActivateAi()
                isActivating = false
            }
        }
    }

    val pulseTransition = rememberInfiniteTransition(label = "cta_glow")
    val glowAlpha by pulseTransition.animateFloat(
        initialValue = 0.45f,
        targetValue = 0.9f,
        animationSpec = infiniteRepeatable(
            animation = tween(1600, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "cta_alpha"
    )

    BoxWithConstraints(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.TopCenter
    ) {
        val brainSize = (minOf(maxWidth, maxHeight) * 0.56f).coerceIn(210.dp, 320.dp)

        Column(
            modifier = Modifier
                .fillMaxSize()
                .widthIn(max = 720.dp)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.weight(1f, fill = false)
                ) {
                    NeonMiniBrainGlyph(size = 40.dp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Column {
                        Text(
                            text = stringResource(R.string.brand_title),
                            style = MaterialTheme.typography.titleLarge.copy(
                                fontSize = 16.sp,
                                letterSpacing = 1.6.sp
                            ),
                            color = IceWhite
                        )
                        Text(
                            text = "BY ALANKRIT PATHAK",
                            style = MaterialTheme.typography.labelSmall.copy(fontSize = 9.sp),
                            color = NeonCyan.copy(alpha = 0.85f)
                        )
                    }
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    AiStatusPill(
                        text = if (isActivating) {
                            stringResource(R.string.ai_status_activating)
                        } else {
                            stringResource(R.string.ai_status_ready)
                        },
                        isActivating = isActivating
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    IconButton(
                        onClick = { showMenuSheet = true },
                        modifier = Modifier
                            .size(48.dp)
                            .testTag("core_menu_button")
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Menu,
                            contentDescription = stringResource(R.string.menu_cd),
                            tint = IceWhite
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.fillMaxWidth()
            ) {
                HolographicBrain(
                    isActivating = isActivating,
                    onBrainTap = triggerActivation,
                    modifier = Modifier.size(brainSize)
                )

                Text(
                    text = if (isActivating) "INITIALIZING INFFOLER CORE…" else "TAP BRAIN TO ACTIVATE",
                    style = MaterialTheme.typography.labelSmall.copy(letterSpacing = 1.6.sp),
                    color = if (isActivating) NeonCyan else LavenderMuted.copy(alpha = 0.85f)
                )

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = stringResource(R.string.hero_headline),
                    style = MaterialTheme.typography.headlineLarge.copy(
                        letterSpacing = 0.6.sp,
                        fontWeight = FontWeight.Bold
                    ),
                    color = IceWhite,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(6.dp))

                Text(
                    text = stringResource(R.string.hero_subtitle),
                    style = MaterialTheme.typography.bodyLarge,
                    color = NeonCyan.copy(alpha = 0.92f),
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(8.dp))

                Surface(
                    shape = CircleShape,
                    color = GlassPanelElevated.copy(alpha = 0.85f),
                    border = BorderStroke(1.dp, ElectricPurple.copy(alpha = 0.45f)),
                    modifier = Modifier
                        .clip(CircleShape)
                        .clickable(onClick = onOpenCreatorProfile)
                        .testTag("core_founder_badge")
                ) {
                    Text(
                        text = "FOUNDER: ALANKRIT PATHAK · VIEW PROFILE →",
                        style = MaterialTheme.typography.labelSmall,
                        color = BrightViolet,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(18.dp))

            Button(
                onClick = triggerActivation,
                enabled = !isActivating,
                shape = CircleShape,
                contentPadding = PaddingValues(0.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color.Transparent,
                    disabledContainerColor = Color.Transparent
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(max = 320.dp)
                    .height(56.dp)
                    .shadow(
                        elevation = 20.dp,
                        shape = CircleShape,
                        ambientColor = ElectricPurple.copy(alpha = glowAlpha),
                        spotColor = NeonCyan.copy(alpha = glowAlpha)
                    )
                    .testTag("activate_ai_button")
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            brush = Brush.horizontalGradient(
                                listOf(DeepViolet, ElectricPurple, ElectricBlue, NeonCyan)
                            ),
                            shape = CircleShape
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Rounded.Bolt,
                            contentDescription = null,
                            tint = DeepSpaceBlack,
                            modifier = Modifier.size(22.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = if (isActivating) "ACTIVATING…" else stringResource(R.string.activate_ai),
                            style = MaterialTheme.typography.labelLarge.copy(letterSpacing = 1.8.sp),
                            color = DeepSpaceBlack
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(28.dp))

            ConnectWithAlankritSection()

            Spacer(modifier = Modifier.height(18.dp))

            InffolerFooter(onOpenCreatorProfile = onOpenCreatorProfile)

            Spacer(modifier = Modifier.height(14.dp))
        }
    }

    if (showMenuSheet) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { showMenuSheet = false },
            sheetState = sheetState,
            containerColor = ObsidianVoid,
            contentColor = IceWhite
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 8.dp)
            ) {
                Text(
                    text = stringResource(R.string.brand_title),
                    style = MaterialTheme.typography.titleLarge,
                    color = IceWhite
                )
                Text(
                    text = stringResource(R.string.brand_tagline),
                    style = MaterialTheme.typography.bodyMedium,
                    color = LavenderMuted
                )
                Spacer(modifier = Modifier.height(16.dp))
                HorizontalDivider(color = GlassBorder)

                ListItem(
                    headlineContent = { Text("Founder Profile — Alankrit Pathak") },
                    supportingContent = { Text("About creator, vision & all 6 Instagram links") },
                    leadingContent = {
                        Icon(Icons.Rounded.Person, contentDescription = null, tint = BrightViolet)
                    },
                    colors = ListItemDefaults.colors(containerColor = Color.Transparent, headlineColor = IceWhite, supportingColor = LavenderMuted),
                    modifier = Modifier.clickable {
                        showMenuSheet = false
                        onOpenCreatorProfile()
                    }
                )
                ListItem(
                    headlineContent = { Text("Start New AI Session") },
                    supportingContent = { Text("Open a fresh INFFOLER AI chat thread") },
                    leadingContent = {
                        Icon(Icons.Rounded.AutoAwesome, contentDescription = null, tint = NeonCyan)
                    },
                    colors = ListItemDefaults.colors(containerColor = Color.Transparent, headlineColor = IceWhite, supportingColor = LavenderMuted),
                    modifier = Modifier.clickable {
                        showMenuSheet = false
                        onStartNewChat()
                    }
                )
                ListItem(
                    headlineContent = { Text("Launch WHAT IF Simulator") },
                    supportingContent = { Text("Explore structured hypothetical timelines") },
                    leadingContent = {
                        Icon(Icons.Rounded.Science, contentDescription = null, tint = BrightViolet)
                    },
                    colors = ListItemDefaults.colors(containerColor = Color.Transparent, headlineColor = IceWhite, supportingColor = LavenderMuted),
                    modifier = Modifier.clickable {
                        showMenuSheet = false
                        onOpenWhatIfMode()
                    }
                )
                ListItem(
                    headlineContent = { Text("Clear App Cache") },
                    supportingContent = { Text("Free temporary files and refresh cached AI models") },
                    leadingContent = {
                        Icon(Icons.Rounded.CleaningServices, contentDescription = null, tint = QuantumTeal)
                    },
                    colors = ListItemDefaults.colors(containerColor = Color.Transparent, headlineColor = IceWhite, supportingColor = LavenderMuted),
                    modifier = Modifier
                        .testTag("clear_cache_item")
                        .clickable {
                            showMenuSheet = false
                            onClearAppCache()
                        }
                )
                ListItem(
                    headlineContent = { Text("Clear Local Conversation Storage") },
                    supportingContent = { Text("Remove all locally saved chats and simulations") },
                    leadingContent = {
                        Icon(Icons.Rounded.DeleteSweep, contentDescription = null, tint = ErrorCrimson)
                    },
                    colors = ListItemDefaults.colors(containerColor = Color.Transparent, headlineColor = IceWhite, supportingColor = LavenderMuted),
                    modifier = Modifier.clickable {
                        showMenuSheet = false
                        onClearAllLocalData()
                    }
                )
                Spacer(modifier = Modifier.height(12.dp))
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = GlassPanel,
                    border = BorderStroke(1.dp, GlassBorder),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Text(
                            text = "INFFOLER AI · FOUNDER: ALANKRIT PATHAK",
                            style = MaterialTheme.typography.labelSmall,
                            color = QuantumTeal
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Powered by Gemini via Firebase AI Logic with automatic retries, fallback models, and local Room storage.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = LavenderMuted
                        )
                    }
                }
                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}
