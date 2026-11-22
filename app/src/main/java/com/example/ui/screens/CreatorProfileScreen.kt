package com.example.ui.screens

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
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
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.Forum
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Psychology
import androidx.compose.material.icons.rounded.Science
import androidx.compose.material.icons.rounded.Verified
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.R
import com.example.ui.components.ConnectWithAlankritSection
import com.example.ui.components.GlassCard
import com.example.ui.components.InffolerFooter
import com.example.ui.components.ViewOnGitHubButton
import com.example.ui.theme.BrightViolet
import com.example.ui.theme.DeepSpaceBlack
import com.example.ui.theme.DeepViolet
import com.example.ui.theme.ElectricBlue
import com.example.ui.theme.ElectricPurple
import com.example.ui.theme.GlassBorder
import com.example.ui.theme.GlassPanelElevated
import com.example.ui.theme.IceWhite
import com.example.ui.theme.LavenderMuted
import com.example.ui.theme.NeonCyan
import com.example.ui.theme.QuantumMagenta
import com.example.ui.theme.QuantumTeal

@Composable
fun CreatorProfileScreen(
    onAskAboutCreator: () -> Unit,
    onOpenWhatIfMode: () -> Unit,
    modifier: Modifier = Modifier
) {
    val transition = rememberInfiniteTransition(label = "creator_aura")
    val ringRotation by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 12000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "ring_rot"
    )
    val glowPulse by transition.animateFloat(
        initialValue = 0.45f,
        targetValue = 0.95f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 2200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "glow_pulse"
    )

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
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            // Animated Founder Hero Profile Card
            GlassCard(
                shape = RoundedCornerShape(26.dp),
                borderBrush = Brush.linearGradient(
                    listOf(ElectricPurple.copy(alpha = 0.7f), NeonCyan.copy(alpha = 0.7f))
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Surface(
                        shape = CircleShape,
                        color = GlassPanelElevated,
                        border = BorderStroke(1.dp, QuantumTeal.copy(alpha = 0.5f))
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 5.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Verified,
                                contentDescription = null,
                                tint = QuantumTeal,
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "OFFICIAL CREATOR IDENTITY",
                                style = MaterialTheme.typography.labelSmall,
                                color = QuantumTeal
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(18.dp))

                    // Animated Avatar Halo
                    Box(
                        modifier = Modifier.size(116.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Canvas(modifier = Modifier.fillMaxSize()) {
                            drawCircle(
                                brush = Brush.radialGradient(
                                    listOf(
                                        ElectricPurple.copy(alpha = 0.35f * glowPulse),
                                        NeonCyan.copy(alpha = 0.16f * glowPulse),
                                        Color.Transparent
                                    )
                                )
                            )
                            rotate(ringRotation) {
                                drawCircle(
                                    brush = Brush.sweepGradient(
                                        listOf(NeonCyan, ElectricPurple, QuantumMagenta, NeonCyan)
                                    ),
                                    radius = size.minDimension * 0.45f,
                                    style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round)
                                )
                            }
                        }
                        Box(
                            modifier = Modifier
                                .size(86.dp)
                                .clip(CircleShape)
                                .background(
                                    Brush.linearGradient(listOf(DeepViolet, ElectricPurple, ElectricBlue))
                                ),
                            contentAlignment = Alignment.Center
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
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = stringResource(R.string.creator_name),
                        style = MaterialTheme.typography.headlineLarge.copy(
                            letterSpacing = 1.2.sp
                        ),
                        color = IceWhite,
                        textAlign = TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(4.dp))

                    Text(
                        text = stringResource(R.string.creator_role),
                        style = MaterialTheme.typography.titleMedium,
                        color = NeonCyan,
                        textAlign = TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    Text(
                        text = stringResource(R.string.creator_quote),
                        style = MaterialTheme.typography.bodyLarge.copy(fontStyle = FontStyle.Italic),
                        color = BrightViolet,
                        textAlign = TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(18.dp))

                    // Contact & Interactive Action Buttons
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Button(
                            onClick = onAskAboutCreator,
                            shape = CircleShape,
                            colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                            modifier = Modifier
                                .weight(1f)
                                .height(48.dp)
                                .background(
                                    Brush.horizontalGradient(listOf(ElectricPurple, NeonCyan)),
                                    CircleShape
                                )
                                .testTag("creator_ask_ai_button")
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Forum,
                                contentDescription = null,
                                tint = DeepSpaceBlack,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Ask AI",
                                style = MaterialTheme.typography.labelLarge,
                                color = DeepSpaceBlack
                            )
                        }

                        OutlinedButton(
                            onClick = onOpenWhatIfMode,
                            shape = CircleShape,
                            border = BorderStroke(1.dp, NeonCyan.copy(alpha = 0.65f)),
                            modifier = Modifier
                                .weight(1f)
                                .height(48.dp)
                                .testTag("creator_what_if_button")
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Science,
                                contentDescription = null,
                                tint = NeonCyan,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "WHAT IF Lab",
                                style = MaterialTheme.typography.labelLarge,
                                color = NeonCyan
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    ViewOnGitHubButton(
                        modifier = Modifier.fillMaxWidth(),
                        testTag = "creator_view_on_github_button"
                    )
                }
            }

            // About Me Card
            GlassCard(
                borderBrush = Brush.linearGradient(
                    listOf(ElectricPurple.copy(alpha = 0.55f), GlassBorder)
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(18.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Rounded.Person,
                            contentDescription = null,
                            tint = BrightViolet,
                            modifier = Modifier.size(22.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "ABOUT ME",
                            style = MaterialTheme.typography.labelMedium,
                            color = BrightViolet
                        )
                    }
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = "I am Alankrit Pathak — an innovator, builder, and AI product creator passionate about turning ambitious concepts into interactive, human-centered technology. INFFOLER AI represents my vision of making futuristic intelligence accessible, expressive, and genuinely useful on mobile devices.",
                        style = MaterialTheme.typography.bodyLarge,
                        color = IceWhite
                    )
                }
            }

            // About INFFOLER AI Card
            GlassCard(
                borderBrush = Brush.linearGradient(
                    listOf(NeonCyan.copy(alpha = 0.55f), GlassBorder)
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(18.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Rounded.Psychology,
                            contentDescription = null,
                            tint = NeonCyan,
                            modifier = Modifier.size(22.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "ABOUT INFFOLER AI",
                            style = MaterialTheme.typography.labelMedium,
                            color = NeonCyan
                        )
                    }
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = "INFFOLER AI is a next-generation artificial intelligence platform combining a real-time conversational assistant, the structured WHAT IF hypothetical scenario simulator, domain prompt launchers, and persistent local conversation memory—powered by Gemini models with automatic failover resilience.",
                        style = MaterialTheme.typography.bodyLarge,
                        color = IceWhite
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Rounded.AutoAwesome,
                            contentDescription = null,
                            tint = QuantumTeal,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "APP: INFFOLER AI · FOUNDER: ALANKRIT PATHAK",
                            style = MaterialTheme.typography.labelSmall,
                            color = QuantumTeal
                        )
                    }
                }
            }

            // Vision Card
            GlassCard(
                borderBrush = Brush.linearGradient(
                    listOf(BrightViolet.copy(alpha = 0.55f), GlassBorder)
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(18.dp)) {
                    Text(
                        text = "VISION · YOUR INTELLIGENCE. YOUR ASSISTANT. YOUR FUTURE.",
                        style = MaterialTheme.typography.labelMedium,
                        color = BrightViolet
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = "To create a powerful, intelligent, and user-friendly AI assistant that helps people:\n" +
                            "• Answer questions and understand concepts\n" +
                            "• Learn new things\n" +
                            "• Generate creative ideas\n" +
                            "• Solve everyday problems\n" +
                            "• Experience AI through a modern interface",
                        style = MaterialTheme.typography.bodyLarge,
                        color = IceWhite
                    )
                }
            }

            // Technology Card
            GlassCard(
                borderBrush = Brush.linearGradient(
                    listOf(QuantumTeal.copy(alpha = 0.55f), GlassBorder)
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(18.dp)) {
                    Text(
                        text = "TECHNOLOGY",
                        style = MaterialTheme.typography.labelMedium,
                        color = QuantumTeal
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = "• Google AI Studio & AI-powered Gemini language models\n" +
                            "• Modern Jetpack Compose & responsive Web companion UI\n" +
                            "• GitHub for project development, Actions CI & Pages hosting",
                        style = MaterialTheme.typography.bodyLarge,
                        color = IceWhite
                    )
                }
            }

            // Dedicated CONNECT WITH ALANKRIT section (all 6 Instagram accounts)
            ConnectWithAlankritSection()

            // Application Footer
            InffolerFooter()

            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}
