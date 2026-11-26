package com.example.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.Casino
import androidx.compose.material.icons.rounded.CleaningServices
import androidx.compose.material.icons.rounded.DeleteSweep
import androidx.compose.material.icons.rounded.Explore
import androidx.compose.material.icons.rounded.Forum
import androidx.compose.material.icons.rounded.HelpOutline
import androidx.compose.material.icons.rounded.KeyboardArrowDown
import androidx.compose.material.icons.rounded.KeyboardArrowUp
import androidx.compose.material.icons.rounded.Lightbulb
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Psychology
import androidx.compose.material.icons.rounded.RocketLaunch
import androidx.compose.material.icons.rounded.Science
import androidx.compose.material.icons.rounded.Verified
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.R
import com.example.data.CreatorIdentity
import com.example.ui.components.ConnectWithAlankritCompactCard
import com.example.ui.components.GlassCard
import com.example.ui.components.InffolerCrownGlyph
import com.example.ui.components.InffolerFooter
import com.example.ui.components.InstagramGlyph
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
import com.example.ui.theme.QuantumMagenta
import com.example.ui.theme.QuantumTeal

private val randomWhatIfQuestions = listOf(
    "What if humans could remember every single dream with perfect clarity?",
    "What if Earth's oceans suddenly turned completely transparent?",
    "What if gravity decreased by 25% across the entire planet tomorrow?",
    "What if an AI discovered a way to translate animal languages in real time?",
    "What if sleep became completely optional for human survival?"
)

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun HomeScreen(
    onSubmitPrompt: (String) -> Unit,
    onOpenCore: () -> Unit,
    onOpenChat: () -> Unit,
    onOpenWhatIfMode: () -> Unit,
    onLaunchRandomWhatIf: (String) -> Unit,
    onOpenExplore: () -> Unit,
    onOpenCreatorProfile: () -> Unit,
    onClearAppCache: () -> Unit,
    onClearAllLocalData: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var promptText by remember { mutableStateOf("") }
    var expandSocialDropdown by remember { mutableStateOf(false) }
    var showNotificationsSheet by remember { mutableStateOf(false) }
    var showSettingsSheet by remember { mutableStateOf(false) }

    val pulseTransition = rememberInfiniteTransition(label = "home_aura")
    val auraGlow by pulseTransition.animateFloat(
        initialValue = 0.55f,
        targetValue = 0.95f,
        animationSpec = infiniteRepeatable(
            animation = tween(2200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "aura_glow"
    )

    val submitQuickPrompt: () -> Unit = {
        val cleaned = promptText.trim()
        if (cleaned.isNotEmpty()) {
            promptText = ""
            onSubmitPrompt(cleaned)
        }
    }

    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.TopCenter
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .widthIn(max = 760.dp)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // 1. TOP HEADER BAR: Neon Brain + Crown + INFFOLER AI + Bell & Settings
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.weight(1f)
                ) {
                    NeonMiniBrainGlyph(size = 46.dp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Column {
                        Box(contentAlignment = Alignment.TopCenter) {
                            InffolerCrownGlyph(
                                size = 16.dp,
                                modifier = Modifier
                                    .align(Alignment.TopStart)
                                    .offset(x = 54.dp, y = (-12).dp)
                            )
                            Text(
                                text = buildAnnotatedString {
                                    withStyle(
                                        SpanStyle(
                                            color = IceWhite,
                                            fontWeight = FontWeight.ExtraBold,
                                            fontStyle = FontStyle.Italic
                                        )
                                    ) {
                                        append("INFFOLER ")
                                    }
                                    withStyle(
                                        SpanStyle(
                                            color = NeonCyan,
                                            fontWeight = FontWeight.ExtraBold,
                                            fontStyle = FontStyle.Italic
                                        )
                                    ) {
                                        append("AI")
                                    }
                                },
                                style = MaterialTheme.typography.headlineMedium.copy(
                                    fontSize = 22.sp,
                                    letterSpacing = 0.8.sp
                                )
                            )
                        }
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .width(18.dp)
                                    .height(1.5.dp)
                                    .background(ElectricPurple.copy(alpha = 0.7f))
                            )
                            Text(
                                text = stringResource(R.string.home_subtitle_companion),
                                style = MaterialTheme.typography.bodyMedium.copy(fontSize = 11.5.sp),
                                color = IceWhite.copy(alpha = 0.82f),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Box(
                                modifier = Modifier
                                    .width(18.dp)
                                    .height(1.5.dp)
                                    .background(NeonCyan.copy(alpha = 0.7f))
                            )
                        }
                    }
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Box {
                        Surface(
                            shape = CircleShape,
                            color = GlassPanelElevated.copy(alpha = 0.88f),
                            border = BorderStroke(1.dp, ElectricPurple.copy(alpha = 0.55f)),
                            modifier = Modifier
                                .size(44.dp)
                                .clip(CircleShape)
                                .clickable { showNotificationsSheet = true }
                                .testTag("home_notifications_button")
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.Outlined.Notifications,
                                    contentDescription = stringResource(R.string.notifications_cd),
                                    tint = IceWhite,
                                    modifier = Modifier.size(21.dp)
                                )
                            }
                        }
                        Box(
                            modifier = Modifier
                                .size(10.dp)
                                .align(Alignment.TopEnd)
                                .offset(x = (-2).dp, y = 2.dp)
                                .clip(CircleShape)
                                .background(ErrorCrimson)
                        )
                    }

                    Surface(
                        shape = CircleShape,
                        color = GlassPanelElevated.copy(alpha = 0.88f),
                        border = BorderStroke(1.dp, NeonCyan.copy(alpha = 0.45f)),
                        modifier = Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .clickable { showSettingsSheet = true }
                            .testTag("home_settings_button")
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Outlined.Settings,
                                contentDescription = stringResource(R.string.menu_cd),
                                tint = IceWhite,
                                modifier = Modifier.size(21.dp)
                            )
                        }
                    }
                }
            }

            // 2. CREATOR / FOUNDER GLASS CARD
            GlassCard(
                shape = RoundedCornerShape(22.dp),
                borderBrush = Brush.linearGradient(
                    listOf(
                        ElectricPurple.copy(alpha = auraGlow),
                        ElectricBlue.copy(alpha = 0.7f),
                        NeonCyan.copy(alpha = auraGlow)
                    )
                ),
                containerColor = GlassPanel.copy(alpha = 0.84f),
                borderWidth = 1.4.dp,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("home_creator_card")
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Circular Glowing Anime Avatar + Verified Badge
                        Box(
                            modifier = Modifier
                                .size(78.dp)
                                .clickable(onClick = onOpenCreatorProfile)
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .clip(CircleShape)
                                    .border(
                                        width = 2.2.dp,
                                        brush = Brush.linearGradient(
                                            listOf(ElectricPurple, ElectricBlue, NeonCyan)
                                        ),
                                        shape = CircleShape
                                    )
                                    .padding(2.dp)
                                    .clip(CircleShape)
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
                            Surface(
                                shape = CircleShape,
                                color = DeepViolet,
                                border = BorderStroke(1.5.dp, IceWhite),
                                modifier = Modifier
                                    .size(24.dp)
                                    .align(Alignment.BottomEnd)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(
                                        imageVector = Icons.Rounded.Verified,
                                        contentDescription = "Verified Founder",
                                        tint = IceWhite,
                                        modifier = Modifier.size(15.dp)
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.width(12.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.weight(1f, fill = false)
                                ) {
                                    Text(
                                        text = stringResource(R.string.creator_name),
                                        style = MaterialTheme.typography.titleMedium.copy(
                                            fontWeight = FontWeight.ExtraBold,
                                            fontSize = 15.5.sp
                                        ),
                                        color = IceWhite,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Icon(
                                        imageVector = Icons.Rounded.Verified,
                                        contentDescription = null,
                                        tint = ElectricPurple,
                                        modifier = Modifier.size(16.dp)
                                    )
                                }

                                Surface(
                                    shape = CircleShape,
                                    color = ObsidianVoid.copy(alpha = 0.78f),
                                    border = BorderStroke(1.dp, NeonCyan.copy(alpha = 0.65f)),
                                    modifier = Modifier
                                        .clip(CircleShape)
                                        .clickable(onClick = onOpenCreatorProfile)
                                        .testTag("home_view_profile_button")
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = "View Profile",
                                            style = MaterialTheme.typography.labelSmall.copy(
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.SemiBold
                                            ),
                                            color = IceWhite
                                        )
                                        Spacer(modifier = Modifier.width(3.dp))
                                        Icon(
                                            imageVector = Icons.AutoMirrored.Rounded.ArrowForward,
                                            contentDescription = null,
                                            tint = NeonCyan,
                                            modifier = Modifier.size(12.dp)
                                        )
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = stringResource(R.string.creator_role),
                                style = MaterialTheme.typography.labelMedium.copy(
                                    fontSize = 11.5.sp,
                                    letterSpacing = 0.2.sp
                                ),
                                color = BrightViolet
                            )
                            Text(
                                text = stringResource(R.string.creator_quote),
                                style = MaterialTheme.typography.bodyMedium.copy(fontSize = 11.5.sp),
                                color = IceWhite.copy(alpha = 0.85f),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )

                            Spacer(modifier = Modifier.height(8.dp))

                            // Interactive 6 Accounts Dropdown + Functional Quick Shortcuts
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Surface(
                                    shape = CircleShape,
                                    color = ObsidianVoid.copy(alpha = 0.6f),
                                    border = BorderStroke(1.dp, GlassBorder),
                                    modifier = Modifier
                                        .clip(CircleShape)
                                        .clickable { expandSocialDropdown = !expandSocialDropdown }
                                        .testTag("home_six_accounts_toggle")
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 9.dp, vertical = 5.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        InstagramGlyph(size = 16.dp)
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text(
                                            text = "6 Accounts",
                                            style = MaterialTheme.typography.labelSmall.copy(
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.SemiBold
                                            ),
                                            color = IceWhite
                                        )
                                        Spacer(modifier = Modifier.width(3.dp))
                                        Icon(
                                            imageVector = if (expandSocialDropdown) {
                                                Icons.Rounded.KeyboardArrowUp
                                            } else {
                                                Icons.Rounded.KeyboardArrowDown
                                            },
                                            contentDescription = "Toggle Instagram accounts list",
                                            tint = LavenderMuted,
                                            modifier = Modifier.size(15.dp)
                                        )
                                    }
                                }

                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    QuickIconPill(
                                        icon = Icons.Rounded.Psychology,
                                        tint = NeonCyan,
                                        contentDescription = "Open Core AI",
                                        onClick = onOpenCore
                                    )
                                    QuickIconPill(
                                        icon = Icons.Rounded.Forum,
                                        tint = BrightViolet,
                                        contentDescription = "Open AI Chat",
                                        onClick = onOpenChat
                                    )
                                    QuickIconPill(
                                        icon = Icons.Rounded.Science,
                                        tint = ElectricBlue,
                                        contentDescription = "Open WHAT IF Mode",
                                        onClick = onOpenWhatIfMode
                                    )
                                }
                            }
                        }
                    }

                    AnimatedVisibility(visible = expandSocialDropdown) {
                        Column(modifier = Modifier.padding(top = 12.dp)) {
                            HorizontalDivider(color = GlassBorder.copy(alpha = 0.7f))
                            Spacer(modifier = Modifier.height(10.dp))
                            FlowRow(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                CreatorIdentity.instagramAccounts.forEach { account ->
                                    Surface(
                                        shape = CircleShape,
                                        color = ObsidianVoid.copy(alpha = 0.85f),
                                        border = BorderStroke(
                                            1.dp,
                                            Brush.horizontalGradient(listOf(QuantumMagenta, NeonCyan))
                                        ),
                                        modifier = Modifier
                                            .clip(CircleShape)
                                            .clickable { CreatorIdentity.openProfile(context, account.url) }
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            InstagramGlyph(size = 14.dp)
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Text(
                                                text = account.username,
                                                style = MaterialTheme.typography.labelSmall,
                                                color = IceWhite
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // 3. HERO BANNER ARTWORK ("Dream Bigger... with INFFOLER AI")
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(144.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .border(
                        width = 1.dp,
                        brush = Brush.horizontalGradient(
                            listOf(ElectricPurple.copy(alpha = 0.4f), NeonCyan.copy(alpha = 0.4f))
                        ),
                        shape = RoundedCornerShape(20.dp)
                    )
                    .clickable(onClick = onOpenCore)
                    .testTag("home_dream_bigger_banner")
            ) {
                Image(
                    painter = painterResource(R.drawable.hero_dream_banner),
                    contentDescription = "Dream Bigger with INFFOLER AI",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                listOf(
                                    DeepSpaceBlack.copy(alpha = 0.32f),
                                    Color.Transparent,
                                    DeepSpaceBlack.copy(alpha = 0.45f)
                                )
                            )
                        )
                )
            }

            // 4. INTERACTIVE "INFFOLER AI - Ask anything... get the best answer!" CARD
            GlassCard(
                shape = RoundedCornerShape(22.dp),
                borderBrush = Brush.linearGradient(
                    listOf(ElectricBlue.copy(alpha = 0.85f), ElectricPurple.copy(alpha = 0.75f), NeonCyan.copy(alpha = 0.85f))
                ),
                containerColor = GlassPanel.copy(alpha = 0.88f),
                borderWidth = 1.3.dp,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("home_ask_ai_card")
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // Header row: Sparkle icon + INFFOLER AI + Powered by Gemini badge
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.weight(1f)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(42.dp)
                                    .clip(CircleShape)
                                    .background(
                                        Brush.linearGradient(listOf(DeepViolet, ElectricPurple, ElectricBlue))
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.AutoAwesome,
                                    contentDescription = null,
                                    tint = IceWhite,
                                    modifier = Modifier.size(22.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(10.dp))
                            Column {
                                Text(
                                    text = stringResource(R.string.brand_title),
                                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.ExtraBold),
                                    color = IceWhite
                                )
                                Text(
                                    text = stringResource(R.string.home_ask_title),
                                    style = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
                                    color = IceWhite.copy(alpha = 0.85f),
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }

                        Spacer(modifier = Modifier.width(8.dp))

                        Surface(
                            shape = RoundedCornerShape(14.dp),
                            color = ObsidianVoid.copy(alpha = 0.85f),
                            border = BorderStroke(1.dp, GlassBorder)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "G",
                                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.ExtraBold),
                                    color = NeonCyan
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Column {
                                    Text(
                                        text = "Powered by",
                                        style = MaterialTheme.typography.labelSmall.copy(fontSize = 8.5.sp),
                                        color = LavenderMuted
                                    )
                                    Text(
                                        text = "Gemini",
                                        style = MaterialTheme.typography.labelLarge.copy(
                                            fontSize = 12.sp,
                                            letterSpacing = 0.2.sp
                                        ),
                                        color = IceWhite
                                    )
                                }
                            }
                        }
                    }

                    // Pill Ask Input Field + Glowing Send Button
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedTextField(
                            value = promptText,
                            onValueChange = { promptText = it },
                            placeholder = {
                                Text(
                                    text = stringResource(R.string.chat_input_hint),
                                    color = LavenderMuted,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            },
                            leadingIcon = {
                                Icon(
                                    imageVector = Icons.Rounded.AutoAwesome,
                                    contentDescription = null,
                                    tint = LavenderMuted,
                                    modifier = Modifier.size(20.dp)
                                )
                            },
                            trailingIcon = {
                                val canSend = promptText.isNotBlank()
                                Box(
                                    modifier = Modifier
                                        .padding(end = 4.dp)
                                        .size(40.dp)
                                        .clip(CircleShape)
                                        .background(
                                            brush = Brush.linearGradient(
                                                if (canSend) {
                                                    listOf(ElectricPurple, NeonCyan)
                                                } else {
                                                    listOf(DeepViolet, ElectricPurple)
                                                }
                                            )
                                        )
                                        .clickable {
                                            if (canSend) {
                                                submitQuickPrompt()
                                            } else {
                                                onOpenChat()
                                            }
                                        }
                                        .testTag("home_prompt_send_button"),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.AutoMirrored.Rounded.Send,
                                        contentDescription = stringResource(R.string.send_cd),
                                        tint = IceWhite,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                            keyboardActions = KeyboardActions(onSend = { submitQuickPrompt() }),
                            shape = CircleShape,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedContainerColor = ObsidianVoid.copy(alpha = 0.82f),
                                unfocusedContainerColor = ObsidianVoid.copy(alpha = 0.72f),
                                focusedBorderColor = NeonCyan,
                                unfocusedBorderColor = GlassBorder,
                                focusedTextColor = IceWhite,
                                unfocusedTextColor = IceWhite,
                                cursorColor = NeonCyan
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("home_prompt_input")
                        )
                    }

                    // 3 Quick Action Suggestion Chips
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        QuickSuggestionChip(
                            icon = Icons.Rounded.Lightbulb,
                            iconTint = Color(0xFFFACC15),
                            label = "Give me ideas",
                            testTag = "chip_give_ideas",
                            onClick = {
                                onSubmitPrompt(
                                    "Give me 5 innovative, futuristic technology and creative project ideas I can explore right now."
                                )
                            }
                        )
                        QuickSuggestionChip(
                            icon = Icons.Rounded.RocketLaunch,
                            iconTint = QuantumMagenta,
                            label = "Explore ideas",
                            testTag = "chip_explore_ideas",
                            onClick = onOpenExplore
                        )
                        QuickSuggestionChip(
                            icon = Icons.Rounded.Casino,
                            iconTint = NeonCyan,
                            label = "Random What If",
                            testTag = "chip_random_what_if",
                            onClick = {
                                val randomQuestion = randomWhatIfQuestions.random()
                                onLaunchRandomWhatIf(randomQuestion)
                            }
                        )
                    }
                }
            }

            // 5. 2x2 FEATURE GRID (Core AI, AI Chat, WHAT IF, Explore)
            BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
                val isCompact = maxWidth < 340.dp
                if (isCompact) {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        HomeFeatureCard(
                            title = "Core AI",
                            subtitle = "Smart & Powerful AI",
                            icon = Icons.Rounded.Psychology,
                            accent = NeonCyan,
                            testTag = "grid_core_ai",
                            onClick = onOpenCore,
                            modifier = Modifier.fillMaxWidth()
                        )
                        HomeFeatureCard(
                            title = "AI Chat",
                            subtitle = "Chat with INFFOLER AI",
                            icon = Icons.Rounded.Forum,
                            accent = ElectricPurple,
                            testTag = "grid_ai_chat",
                            onClick = onOpenChat,
                            modifier = Modifier.fillMaxWidth()
                        )
                        HomeFeatureCard(
                            title = "WHAT IF",
                            subtitle = "Explore Possibilities",
                            icon = Icons.Rounded.HelpOutline,
                            accent = BrightViolet,
                            testTag = "grid_what_if",
                            onClick = onOpenWhatIfMode,
                            modifier = Modifier.fillMaxWidth()
                        )
                        HomeFeatureCard(
                            title = "Explore",
                            subtitle = "Discover More",
                            icon = Icons.Rounded.Explore,
                            accent = ElectricBlue,
                            testTag = "grid_explore",
                            onClick = onOpenExplore,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            HomeFeatureCard(
                                title = "Core AI",
                                subtitle = "Smart & Powerful AI",
                                icon = Icons.Rounded.Psychology,
                                accent = NeonCyan,
                                testTag = "grid_core_ai",
                                onClick = onOpenCore,
                                modifier = Modifier.weight(1f)
                            )
                            HomeFeatureCard(
                                title = "AI Chat",
                                subtitle = "Chat with INFFOLER AI",
                                icon = Icons.Rounded.Forum,
                                accent = ElectricPurple,
                                testTag = "grid_ai_chat",
                                onClick = onOpenChat,
                                modifier = Modifier.weight(1f)
                            )
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            HomeFeatureCard(
                                title = "WHAT IF",
                                subtitle = "Explore Possibilities",
                                icon = Icons.Rounded.HelpOutline,
                                accent = BrightViolet,
                                testTag = "grid_what_if",
                                onClick = onOpenWhatIfMode,
                                modifier = Modifier.weight(1f)
                            )
                            HomeFeatureCard(
                                title = "Explore",
                                subtitle = "Discover More",
                                icon = Icons.Rounded.Explore,
                                accent = ElectricBlue,
                                testTag = "grid_explore",
                                onClick = onOpenExplore,
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            }

            // 6. CONNECT WITH ALANKRIT (All 6 Instagram badges + Open All Instagram Profiles button)
            ConnectWithAlankritCompactCard()

            // 7. OFFICIAL INFFOLER AI APPLICATION FOOTER
            InffolerFooter(onOpenCreatorProfile = onOpenCreatorProfile)

            Spacer(modifier = Modifier.height(6.dp))
        }
    }

    if (showNotificationsSheet) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { showNotificationsSheet = false },
            sheetState = sheetState,
            containerColor = ObsidianVoid,
            contentColor = IceWhite
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    text = "INFFOLER AI · Neural Status",
                    style = MaterialTheme.typography.titleLarge,
                    color = IceWhite
                )
                Text(
                    text = "Live platform updates & model readiness",
                    style = MaterialTheme.typography.bodyMedium,
                    color = LavenderMuted
                )
                HorizontalDivider(color = GlassBorder)
                ListItem(
                    headlineContent = { Text("Gemini AI Engine Active") },
                    supportingContent = { Text("Multi-model failover enabled (3.8 Flash, 3.5 Flash Lite, 4 Argon)") },
                    leadingContent = {
                        Icon(Icons.Rounded.AutoAwesome, contentDescription = null, tint = NeonCyan)
                    },
                    colors = ListItemDefaults.colors(containerColor = Color.Transparent, headlineColor = IceWhite, supportingColor = LavenderMuted),
                    modifier = Modifier.clickable {
                        showNotificationsSheet = false
                        onOpenChat()
                    }
                )
                ListItem(
                    headlineContent = { Text("WHAT IF Simulator Ready") },
                    supportingContent = { Text("Run 6-phase hypothetical reality scenarios") },
                    leadingContent = {
                        Icon(Icons.Rounded.Science, contentDescription = null, tint = BrightViolet)
                    },
                    colors = ListItemDefaults.colors(containerColor = Color.Transparent, headlineColor = IceWhite, supportingColor = LavenderMuted),
                    modifier = Modifier.clickable {
                        showNotificationsSheet = false
                        onOpenWhatIfMode()
                    }
                )
                ListItem(
                    headlineContent = { Text("Created by Alankrit Pathak") },
                    supportingContent = { Text("View founder profile & all 6 Instagram links") },
                    leadingContent = {
                        Icon(Icons.Rounded.Person, contentDescription = null, tint = QuantumTeal)
                    },
                    colors = ListItemDefaults.colors(containerColor = Color.Transparent, headlineColor = IceWhite, supportingColor = LavenderMuted),
                    modifier = Modifier.clickable {
                        showNotificationsSheet = false
                        onOpenCreatorProfile()
                    }
                )
                Spacer(modifier = Modifier.height(18.dp))
            }
        }
    }

    if (showSettingsSheet) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { showSettingsSheet = false },
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
                Spacer(modifier = Modifier.height(14.dp))
                HorizontalDivider(color = GlassBorder)
                ListItem(
                    headlineContent = { Text("Founder Profile — Alankrit Pathak") },
                    supportingContent = { Text("About creator, vision & all 6 Instagram links") },
                    leadingContent = {
                        Icon(Icons.Rounded.Person, contentDescription = null, tint = BrightViolet)
                    },
                    colors = ListItemDefaults.colors(containerColor = Color.Transparent, headlineColor = IceWhite, supportingColor = LavenderMuted),
                    modifier = Modifier.clickable {
                        showSettingsSheet = false
                        onOpenCreatorProfile()
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
                            showSettingsSheet = false
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
                        showSettingsSheet = false
                        onClearAllLocalData()
                    }
                )
                Spacer(modifier = Modifier.height(20.dp))
            }
        }
    }
}

@Composable
private fun QuickIconPill(
    icon: ImageVector,
    tint: Color,
    contentDescription: String,
    onClick: () -> Unit
) {
    Surface(
        shape = CircleShape,
        color = ObsidianVoid.copy(alpha = 0.7f),
        border = BorderStroke(1.dp, tint.copy(alpha = 0.45f)),
        modifier = Modifier
            .size(34.dp)
            .clip(CircleShape)
            .clickable(onClick = onClick)
    ) {
        Box(contentAlignment = Alignment.Center) {
            Icon(
                imageVector = icon,
                contentDescription = contentDescription,
                tint = tint,
                modifier = Modifier.size(17.dp)
            )
        }
    }
}

@Composable
private fun QuickSuggestionChip(
    icon: ImageVector,
    iconTint: Color,
    label: String,
    testTag: String,
    onClick: () -> Unit
) {
    Surface(
        shape = CircleShape,
        color = ObsidianVoid.copy(alpha = 0.78f),
        border = BorderStroke(1.dp, ElectricPurple.copy(alpha = 0.45f)),
        modifier = Modifier
            .height(36.dp)
            .clip(CircleShape)
            .clickable(onClick = onClick)
            .testTag(testTag)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = iconTint,
                modifier = Modifier.size(15.dp)
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall.copy(
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.Medium,
                    letterSpacing = 0.1.sp
                ),
                color = IceWhite,
                maxLines = 1
            )
        }
    }
}

@Composable
private fun HomeFeatureCard(
    title: String,
    subtitle: String,
    icon: ImageVector,
    accent: Color,
    testTag: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (isPressed) 0.96f else 1f,
        animationSpec = spring(dampingRatio = 0.7f, stiffness = 420f),
        label = "feature_card_scale"
    )

    GlassCard(
        shape = RoundedCornerShape(18.dp),
        borderBrush = Brush.linearGradient(
            listOf(accent.copy(alpha = 0.75f), GlassBorder)
        ),
        containerColor = GlassPanel.copy(alpha = 0.85f),
        borderWidth = 1.2.dp,
        modifier = modifier
            .scale(scale)
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = onClick
            )
            .testTag(testTag)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 11.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(accent.copy(alpha = 0.16f))
                    .border(1.dp, accent.copy(alpha = 0.45f), RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = accent,
                    modifier = Modifier.size(22.dp)
                )
            }

            Spacer(modifier = Modifier.width(8.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontSize = 14.5.sp,
                        fontWeight = FontWeight.Bold
                    ),
                    color = IceWhite,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodyMedium.copy(fontSize = 11.sp),
                    color = LavenderMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Spacer(modifier = Modifier.width(6.dp))

            Box(
                modifier = Modifier
                    .size(28.dp)
                    .clip(CircleShape)
                    .background(
                        Brush.linearGradient(listOf(ElectricBlue, accent))
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Rounded.ArrowForward,
                    contentDescription = null,
                    tint = DeepSpaceBlack,
                    modifier = Modifier.size(16.dp)
                )
            }
        }
    }
}
