package com.example.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.hoverable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsHoveredAsState
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
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.automirrored.rounded.OpenInNew
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.R
import com.example.data.CreatorIdentity
import com.example.data.GitHubRepoPreferences
import com.example.data.InstagramAccount
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

@Composable
fun InffolerCrownGlyph(
    modifier: Modifier = Modifier,
    size: Dp = 18.dp
) {
    Canvas(modifier = modifier.size(size)) {
        val w = this.size.width
        val h = this.size.height
        val path = Path().apply {
            moveTo(w * 0.14f, h * 0.80f)
            lineTo(w * 0.08f, h * 0.30f)
            lineTo(w * 0.33f, h * 0.54f)
            lineTo(w * 0.50f, h * 0.16f)
            lineTo(w * 0.67f, h * 0.54f)
            lineTo(w * 0.92f, h * 0.30f)
            lineTo(w * 0.86f, h * 0.80f)
            close()
        }
        drawPath(
            path = path,
            brush = Brush.verticalGradient(
                listOf(Color(0xFFFDE68A), Color(0xFFF59E0B))
            )
        )
        drawCircle(
            color = Color(0xFFFEF08A),
            radius = w * 0.06f,
            center = Offset(w * 0.50f, h * 0.14f)
        )
        drawCircle(
            color = Color(0xFFFBBF24),
            radius = w * 0.05f,
            center = Offset(w * 0.08f, h * 0.27f)
        )
        drawCircle(
            color = Color(0xFFFBBF24),
            radius = w * 0.05f,
            center = Offset(w * 0.92f, h * 0.27f)
        )
    }
}

@Composable
fun NeonMiniBrainGlyph(
    modifier: Modifier = Modifier,
    size: Dp = 44.dp
) {
    Canvas(modifier = modifier.size(size)) {
        val w = this.size.width
        val h = this.size.height
        val neonBrush = Brush.linearGradient(
            listOf(QuantumMagenta, ElectricPurple, NeonCyan)
        )
        // Ambient aura
        drawCircle(
            brush = Brush.radialGradient(
                listOf(ElectricPurple.copy(alpha = 0.35f), NeonCyan.copy(alpha = 0.18f), Color.Transparent)
            ),
            radius = w * 0.52f,
            center = center
        )
        // Tilted orbital ring
        drawOval(
            brush = Brush.linearGradient(listOf(NeonCyan, ElectricPurple)),
            topLeft = Offset(w * 0.06f, h * 0.24f),
            size = Size(w * 0.88f, h * 0.52f),
            style = Stroke(width = w * 0.045f)
        )
        // Left & right stylized brain contours
        val leftLobe = Path().apply {
            moveTo(w * 0.49f, h * 0.23f)
            cubicTo(w * 0.24f, h * 0.20f, w * 0.16f, h * 0.44f, w * 0.22f, h * 0.62f)
            cubicTo(w * 0.26f, h * 0.76f, w * 0.44f, h * 0.79f, w * 0.49f, h * 0.72f)
        }
        val rightLobe = Path().apply {
            moveTo(w * 0.51f, h * 0.23f)
            cubicTo(w * 0.76f, h * 0.20f, w * 0.84f, h * 0.44f, w * 0.78f, h * 0.62f)
            cubicTo(w * 0.74f, h * 0.76f, w * 0.56f, h * 0.79f, w * 0.51f, h * 0.72f)
        }
        drawPath(
            path = leftLobe,
            brush = neonBrush,
            style = Stroke(width = w * 0.06f, cap = StrokeCap.Round, join = StrokeJoin.Round)
        )
        drawPath(
            path = rightLobe,
            brush = Brush.linearGradient(listOf(ElectricBlue, NeonCyan)),
            style = Stroke(width = w * 0.06f, cap = StrokeCap.Round, join = StrokeJoin.Round)
        )
        // Synaptic nodes inside brain
        listOf(
            Offset(w * 0.36f, h * 0.44f),
            Offset(w * 0.64f, h * 0.44f),
            Offset(w * 0.50f, h * 0.38f),
            Offset(w * 0.40f, h * 0.58f),
            Offset(w * 0.60f, h * 0.58f)
        ).forEachIndexed { idx, pt ->
            drawCircle(
                color = if (idx % 2 == 0) NeonCyan else BrightViolet,
                radius = w * 0.045f,
                center = pt
            )
        }
    }
}

@Composable
fun InstagramGlyph(
    modifier: Modifier = Modifier,
    size: Dp = 22.dp
) {
    Canvas(
        modifier = modifier
            .size(size)
            .semantics { contentDescription = "Instagram" }
    ) {
        val strokeWidth = this.size.minDimension * 0.11f
        val gradient = Brush.linearGradient(
            colors = listOf(QuantumMagenta, ElectricPurple, NeonCyan)
        )
        val inset = strokeWidth / 2f
        val rectSize = this.size.minDimension - strokeWidth
        drawRoundRect(
            brush = gradient,
            topLeft = Offset(inset, inset),
            size = Size(rectSize, rectSize),
            cornerRadius = CornerRadius(this.size.minDimension * 0.28f, this.size.minDimension * 0.28f),
            style = Stroke(width = strokeWidth)
        )
        drawCircle(
            brush = gradient,
            radius = this.size.minDimension * 0.22f,
            center = center,
            style = Stroke(width = strokeWidth)
        )
        drawCircle(
            color = NeonCyan,
            radius = this.size.minDimension * 0.065f,
            center = Offset(this.size.width * 0.74f, this.size.height * 0.26f)
        )
    }
}

/**
 * Compact 6-badge circular Instagram launcher card matching the Home dashboard interface,
 * plus an "Open All Instagram Profiles" modal sheet so every account is immediately reachable.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ConnectWithAlankritCompactCard(
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val accounts = CreatorIdentity.instagramAccounts
    var showAllSheet by remember { mutableStateOf(false) }

    GlassCard(
        shape = RoundedCornerShape(24.dp),
        borderBrush = Brush.linearGradient(
            listOf(ElectricPurple.copy(alpha = 0.75f), NeonCyan.copy(alpha = 0.70f))
        ),
        containerColor = GlassPanel.copy(alpha = 0.84f),
        borderWidth = 1.2.dp,
        modifier = modifier
            .fillMaxWidth()
            .testTag("connect_with_alankrit_compact_card")
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(
                            Brush.linearGradient(listOf(QuantumMagenta, ElectricPurple, Color(0xFFF59E0B)))
                        )
                        .padding(8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Canvas(modifier = Modifier.size(22.dp)) {
                        val sw = size.minDimension * 0.12f
                        val inset = sw / 2f
                        drawRoundRect(
                            color = IceWhite,
                            topLeft = Offset(inset, inset),
                            size = Size(size.width - sw, size.height - sw),
                            cornerRadius = CornerRadius(size.minDimension * 0.28f, size.minDimension * 0.28f),
                            style = Stroke(width = sw)
                        )
                        drawCircle(
                            color = IceWhite,
                            radius = size.minDimension * 0.22f,
                            center = center,
                            style = Stroke(width = sw)
                        )
                        drawCircle(
                            color = IceWhite,
                            radius = size.minDimension * 0.065f,
                            center = Offset(size.width * 0.74f, size.height * 0.26f)
                        )
                    }
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        text = stringResource(R.string.connect_with_alankrit),
                        style = MaterialTheme.typography.titleLarge.copy(
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 0.6.sp
                        ),
                        color = IceWhite
                    )
                    Text(
                        text = stringResource(R.string.connect_subtitle),
                        style = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.5.sp),
                        color = LavenderMuted
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Responsive circular neon badge grid displaying all 6 @usernames clearly
            BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
                val columns = if (maxWidth >= 460.dp) 6 else 3
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    accounts.chunked(columns).forEach { rowAccounts ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceEvenly
                        ) {
                            rowAccounts.forEach { account ->
                                InstagramOrbShortcut(
                                    account = account,
                                    onOpen = { CreatorIdentity.openProfile(context, account.url) },
                                    modifier = Modifier.weight(1f)
                                )
                            }
                            repeat(columns - rowAccounts.size) {
                                Spacer(modifier = Modifier.weight(1f))
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Button(
                onClick = { showAllSheet = true },
                shape = CircleShape,
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color.Transparent,
                    contentColor = IceWhite
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .background(
                        Brush.horizontalGradient(listOf(ElectricPurple, ElectricBlue, NeonCyan)),
                        shape = CircleShape
                    )
                    .testTag("open_all_instagram_profiles_btn")
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Rounded.OpenInNew,
                    contentDescription = null,
                    tint = IceWhite,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Open All Instagram Profiles",
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    ),
                    color = IceWhite
                )
                Spacer(modifier = Modifier.width(6.dp))
                Icon(
                    imageVector = Icons.AutoMirrored.Rounded.ArrowForward,
                    contentDescription = null,
                    tint = IceWhite,
                    modifier = Modifier.size(16.dp)
                )
            }
        }
    }

    if (showAllSheet) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { showAllSheet = false },
            sheetState = sheetState,
            containerColor = ObsidianVoid,
            contentColor = IceWhite
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    text = stringResource(R.string.connect_with_alankrit),
                    style = MaterialTheme.typography.titleLarge,
                    color = IceWhite
                )
                Text(
                    text = "Tap any of Alankrit Pathak's 6 official Instagram profiles below to open it:",
                    style = MaterialTheme.typography.bodyMedium,
                    color = LavenderMuted
                )
                HorizontalDivider(color = GlassBorder)
                accounts.forEach { account ->
                    InstagramProfileCard(
                        account = account,
                        onOpen = { CreatorIdentity.openProfile(context, account.url) },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
                Spacer(modifier = Modifier.height(18.dp))
            }
        }
    }
}

@Composable
private fun InstagramOrbShortcut(
    account: InstagramAccount,
    onOpen: () -> Unit,
    modifier: Modifier = Modifier
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val isHovered by interactionSource.collectIsHoveredAsState()
    val scale by animateFloatAsState(
        targetValue = when {
            isPressed -> 0.92f
            isHovered -> 1.07f
            else -> 1f
        },
        animationSpec = spring(dampingRatio = 0.65f, stiffness = 420f),
        label = "ig_orb_scale"
    )

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = modifier
            .scale(scale)
            .clip(RoundedCornerShape(14.dp))
            .hoverable(interactionSource)
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = onOpen
            )
            .padding(vertical = 4.dp, horizontal = 2.dp)
            .testTag("home_ig_orb_${account.username.removePrefix("@")}")
    ) {
        Box(
            modifier = Modifier
                .size(50.dp)
                .clip(CircleShape)
                .background(
                    Brush.radialGradient(
                        listOf(GlassPanelElevated, ObsidianVoid)
                    )
                )
                .border(
                    width = 1.6.dp,
                    brush = Brush.linearGradient(listOf(QuantumMagenta, ElectricPurple, NeonCyan)),
                    shape = CircleShape
                ),
            contentAlignment = Alignment.Center
        ) {
            InstagramGlyph(size = 24.dp)
        }
        Spacer(modifier = Modifier.height(5.dp))
        Text(
            text = account.username,
            style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp),
            color = IceWhite.copy(alpha = 0.92f),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center
        )
    }
}

@Composable
fun ConnectWithAlankritSection(
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val accounts = CreatorIdentity.instagramAccounts

    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column {
                Text(
                    text = stringResource(R.string.connect_with_alankrit),
                    style = MaterialTheme.typography.titleLarge,
                    color = IceWhite
                )
                Text(
                    text = "Official Instagram Profiles · Alankrit Pathak",
                    style = MaterialTheme.typography.labelSmall,
                    color = NeonCyan
                )
            }
            Surface(
                shape = CircleShape,
                color = GlassPanel,
                border = BorderStroke(1.dp, ElectricPurple.copy(alpha = 0.5f))
            ) {
                Text(
                    text = "${accounts.size} PROFILES",
                    style = MaterialTheme.typography.labelSmall,
                    color = BrightViolet,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                )
            }
        }

        BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
            val twoColumns = maxWidth >= 520.dp
            if (twoColumns) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    accounts.chunked(2).forEach { pair ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            pair.forEach { account ->
                                InstagramProfileCard(
                                    account = account,
                                    onOpen = { CreatorIdentity.openProfile(context, account.url) },
                                    modifier = Modifier.weight(1f)
                                )
                            }
                            if (pair.size == 1) {
                                Spacer(modifier = Modifier.weight(1f))
                            }
                        }
                    }
                }
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    accounts.forEach { account ->
                        InstagramProfileCard(
                            account = account,
                            onOpen = { CreatorIdentity.openProfile(context, account.url) },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun InstagramProfileCard(
    account: InstagramAccount,
    onOpen: () -> Unit,
    modifier: Modifier = Modifier
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val isHovered by interactionSource.collectIsHoveredAsState()

    val scale by animateFloatAsState(
        targetValue = when {
            isPressed -> 0.97f
            isHovered -> 1.02f
            else -> 1f
        },
        animationSpec = spring(dampingRatio = 0.7f, stiffness = 420f),
        label = "ig_card_scale"
    )

    val borderBrush = if (isHovered || isPressed) {
        Brush.linearGradient(listOf(QuantumMagenta, ElectricPurple, NeonCyan))
    } else {
        Brush.linearGradient(listOf(ElectricPurple.copy(alpha = 0.45f), NeonCyan.copy(alpha = 0.35f)))
    }

    GlassCard(
        shape = RoundedCornerShape(18.dp),
        borderBrush = borderBrush,
        modifier = modifier
            .scale(scale)
            .hoverable(interactionSource)
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = onOpen
            )
            .testTag("instagram_card_${account.username.removePrefix("@")}")
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f)
            ) {
                IconButton(
                    onClick = onOpen,
                    modifier = Modifier
                        .size(48.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(GlassPanelElevated)
                ) {
                    InstagramGlyph(size = 24.dp)
                }
                Spacer(modifier = Modifier.width(10.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = account.username,
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                        color = IceWhite,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = "Instagram",
                        style = MaterialTheme.typography.labelSmall,
                        color = LavenderMuted
                    )
                }
            }

            Spacer(modifier = Modifier.width(8.dp))

            Button(
                onClick = onOpen,
                shape = CircleShape,
                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color.Transparent,
                    contentColor = DeepSpaceBlack
                ),
                modifier = Modifier
                    .height(40.dp)
                    .background(
                        Brush.horizontalGradient(listOf(ElectricPurple, ElectricBlue, NeonCyan)),
                        shape = CircleShape
                    )
                    .testTag("open_profile_${account.username.removePrefix("@")}")
            ) {
                Text(
                    text = "Open Profile",
                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                    color = DeepSpaceBlack,
                    maxLines = 1
                )
                Spacer(modifier = Modifier.width(4.dp))
                Icon(
                    imageVector = Icons.AutoMirrored.Rounded.OpenInNew,
                    contentDescription = null,
                    tint = DeepSpaceBlack,
                    modifier = Modifier.size(14.dp)
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun InffolerFooter(
    onOpenCreatorProfile: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current

    GlassCard(
        shape = RoundedCornerShape(22.dp),
        borderBrush = Brush.linearGradient(
            listOf(ElectricPurple.copy(alpha = 0.55f), NeonCyan.copy(alpha = 0.5f))
        ),
        modifier = modifier
            .fillMaxWidth()
            .testTag("inffoler_footer")
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                InffolerCrownGlyph(size = 20.dp)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "INFFOLER ",
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.ExtraBold),
                    color = IceWhite
                )
                Text(
                    text = "AI",
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.ExtraBold),
                    color = NeonCyan
                )
            }

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = stringResource(R.string.footer_made_by),
                style = MaterialTheme.typography.bodyMedium,
                color = BrightViolet,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(2.dp))

            Text(
                text = stringResource(R.string.footer_follow_ig),
                style = MaterialTheme.typography.labelSmall,
                color = QuantumTeal,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(12.dp))
            HorizontalDivider(color = GlassBorder.copy(alpha = 0.7f))
            Spacer(modifier = Modifier.height(12.dp))

            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                CreatorIdentity.instagramAccounts.forEach { account ->
                    Surface(
                        shape = CircleShape,
                        color = GlassPanelElevated.copy(alpha = 0.9f),
                        border = BorderStroke(
                            1.dp,
                            Brush.horizontalGradient(
                                listOf(QuantumMagenta.copy(alpha = 0.5f), NeonCyan.copy(alpha = 0.5f))
                            )
                        ),
                        modifier = Modifier
                            .clip(CircleShape)
                            .clickable { CreatorIdentity.openProfile(context, account.url) }
                            .testTag("footer_ig_${account.username.removePrefix("@")}")
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            InstagramGlyph(size = 16.dp)
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

            Spacer(modifier = Modifier.height(14.dp))

            ViewOnGitHubButton(
                modifier = Modifier.fillMaxWidth(),
                testTag = "footer_view_on_github_button"
            )

            if (onOpenCreatorProfile != null) {
                Spacer(modifier = Modifier.height(10.dp))
                Surface(
                    shape = CircleShape,
                    color = DeepViolet.copy(alpha = 0.35f),
                    border = BorderStroke(1.dp, NeonCyan.copy(alpha = 0.45f)),
                    modifier = Modifier
                        .clip(CircleShape)
                        .clickable(onClick = onOpenCreatorProfile)
                        .testTag("footer_creator_profile_btn")
                ) {
                    Text(
                        text = "VIEW FOUNDER PROFILE · ALANKRIT PATHAK",
                        style = MaterialTheme.typography.labelSmall,
                        color = NeonCyan,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun GitHubGlyph(
    modifier: Modifier = Modifier,
    size: Dp = 20.dp,
    tint: Color = IceWhite
) {
    Canvas(
        modifier = modifier
            .size(size)
            .semantics { contentDescription = "GitHub" }
    ) {
        val w = this.size.width
        val h = this.size.height
        // Outer circular mark
        drawCircle(
            color = tint,
            radius = w * 0.46f,
            center = center
        )
        // Stylized Octocat silhouette cut-out in dark void
        val silhouette = Path().apply {
            // Bottom neck & shoulders
            moveTo(w * 0.38f, h * 0.94f)
            lineTo(w * 0.38f, h * 0.78f)
            cubicTo(w * 0.25f, h * 0.81f, w * 0.22f, h * 0.72f, w * 0.20f, h * 0.69f)
            cubicTo(w * 0.17f, h * 0.65f, w * 0.15f, h * 0.64f, w * 0.18f, h * 0.63f)
            cubicTo(w * 0.23f, h * 0.63f, w * 0.26f, h * 0.69f, w * 0.28f, h * 0.71f)
            cubicTo(w * 0.31f, h * 0.75f, w * 0.36f, h * 0.74f, w * 0.39f, h * 0.73f)
            cubicTo(w * 0.39f, h * 0.69f, w * 0.41f, h * 0.66f, w * 0.43f, h * 0.65f)
            // Left cheek & ear
            cubicTo(w * 0.29f, h * 0.63f, w * 0.21f, h * 0.56f, w * 0.21f, h * 0.42f)
            cubicTo(w * 0.21f, h * 0.36f, w * 0.23f, h * 0.31f, w * 0.26f, h * 0.27f)
            cubicTo(w * 0.25f, h * 0.24f, w * 0.25f, h * 0.18f, w * 0.27f, h * 0.15f)
            cubicTo(w * 0.32f, h * 0.16f, w * 0.36f, h * 0.19f, w * 0.39f, h * 0.22f)
            // Forehead crown
            cubicTo(w * 0.46f, h * 0.20f, w * 0.54f, h * 0.20f, w * 0.61f, h * 0.22f)
            // Right ear & cheek
            cubicTo(w * 0.64f, h * 0.19f, w * 0.68f, h * 0.16f, w * 0.73f, h * 0.15f)
            cubicTo(w * 0.75f, h * 0.18f, w * 0.75f, h * 0.24f, w * 0.74f, h * 0.27f)
            cubicTo(w * 0.77f, h * 0.31f, w * 0.79f, h * 0.36f, w * 0.79f, h * 0.42f)
            cubicTo(w * 0.79f, h * 0.56f, w * 0.71f, h * 0.63f, w * 0.57f, h * 0.65f)
            cubicTo(w * 0.60f, h * 0.67f, w * 0.62f, h * 0.71f, w * 0.62f, h * 0.77f)
            lineTo(w * 0.62f, h * 0.94f)
            close()
        }
        drawPath(path = silhouette, color = DeepSpaceBlack)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ViewOnGitHubButton(
    modifier: Modifier = Modifier,
    testTag: String = "view_on_github_button"
) {
    val context = LocalContext.current
    LaunchedEffect(context) {
        GitHubRepoPreferences.ensureLoaded(context)
    }
    val savedRepoUrl by GitHubRepoPreferences.repoUrl.collectAsStateWithLifecycle()

    var showConfigSheet by remember { mutableStateOf(false) }
    var draftInput by remember(savedRepoUrl, showConfigSheet) {
        mutableStateOf(savedRepoUrl.orEmpty())
    }
    var validationError by remember { mutableStateOf<String?>(null) }

    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val isHovered by interactionSource.collectIsHoveredAsState()
    val scale by animateFloatAsState(
        targetValue = when {
            isPressed -> 0.97f
            isHovered -> 1.015f
            else -> 1f
        },
        animationSpec = spring(dampingRatio = 0.7f, stiffness = 420f),
        label = "github_btn_scale"
    )

    val handlePrimaryClick: () -> Unit = {
        val currentUrl = savedRepoUrl
        if (!currentUrl.isNullOrBlank()) {
            CreatorIdentity.openProfile(context, currentUrl)
        } else {
            validationError = null
            showConfigSheet = true
        }
    }

    val handleSaveAndOpen: () -> Unit = {
        val normalized = GitHubRepoPreferences.saveRepoUrl(context, draftInput)
        if (normalized != null) {
            validationError = null
            showConfigSheet = false
            CreatorIdentity.openProfile(context, normalized)
        } else {
            validationError = "Enter a valid GitHub link (e.g. https://github.com/username/inffoler-ai or username/repo)"
        }
    }

    Row(
        modifier = modifier.scale(scale),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Box(
            modifier = Modifier
                .weight(1f)
                .height(50.dp)
                .clip(CircleShape)
                .background(
                    Brush.horizontalGradient(
                        listOf(DeepViolet, ElectricPurple, ElectricBlue, NeonCyan)
                    )
                )
                .border(
                    width = 1.4.dp,
                    brush = Brush.horizontalGradient(
                        listOf(IceWhite.copy(alpha = 0.45f), NeonCyan.copy(alpha = 0.85f))
                    ),
                    shape = CircleShape
                )
                .hoverable(interactionSource)
                .clickable(
                    interactionSource = interactionSource,
                    indication = null,
                    onClick = handlePrimaryClick
                )
                .padding(horizontal = 18.dp)
                .testTag(testTag),
            contentAlignment = Alignment.Center
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                GitHubGlyph(size = 22.dp, tint = IceWhite)
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    text = stringResource(R.string.view_on_github),
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.4.sp
                    ),
                    color = IceWhite,
                    maxLines = 1
                )
                Spacer(modifier = Modifier.width(8.dp))
                Icon(
                    imageVector = Icons.AutoMirrored.Rounded.OpenInNew,
                    contentDescription = null,
                    tint = IceWhite,
                    modifier = Modifier.size(16.dp)
                )
            }
        }

        if (!savedRepoUrl.isNullOrBlank()) {
            Surface(
                shape = CircleShape,
                color = GlassPanelElevated.copy(alpha = 0.9f),
                border = BorderStroke(1.dp, NeonCyan.copy(alpha = 0.55f)),
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .clickable {
                        validationError = null
                        showConfigSheet = true
                    }
                    .testTag("${testTag}_edit")
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Rounded.Edit,
                        contentDescription = "Edit GitHub repository URL",
                        tint = NeonCyan,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }
    }

    if (showConfigSheet) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { showConfigSheet = false },
            sheetState = sheetState,
            containerColor = ObsidianVoid,
            contentColor = IceWhite
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 10.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    GitHubGlyph(size = 26.dp, tint = NeonCyan)
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = "INFFOLER AI · GitHub Repository",
                            style = MaterialTheme.typography.titleLarge,
                            color = IceWhite
                        )
                        Text(
                            text = "Link your GitHub repository to open it directly from anywhere in the app",
                            style = MaterialTheme.typography.bodyMedium,
                            color = LavenderMuted
                        )
                    }
                }

                HorizontalDivider(color = GlassBorder)

                OutlinedTextField(
                    value = draftInput,
                    onValueChange = {
                        draftInput = it
                        if (validationError != null) validationError = null
                    },
                    label = { Text("GitHub Repository URL or owner/repo") },
                    placeholder = { Text("https://github.com/username/inffoler-ai") },
                    singleLine = true,
                    isError = validationError != null,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { handleSaveAndOpen() }),
                    shape = RoundedCornerShape(16.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = GlassPanel,
                        unfocusedContainerColor = GlassPanel.copy(alpha = 0.7f),
                        focusedBorderColor = NeonCyan,
                        unfocusedBorderColor = GlassBorder,
                        focusedTextColor = IceWhite,
                        unfocusedTextColor = IceWhite,
                        cursorColor = NeonCyan
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("github_repo_url_input")
                )

                if (validationError != null) {
                    Text(
                        text = validationError.orEmpty(),
                        style = MaterialTheme.typography.bodyMedium,
                        color = ErrorCrimson
                    )
                }

                Button(
                    onClick = handleSaveAndOpen,
                    shape = CircleShape,
                    colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                        .background(
                            Brush.horizontalGradient(listOf(ElectricPurple, NeonCyan)),
                            CircleShape
                        )
                        .testTag("save_and_open_github_button")
                ) {
                    GitHubGlyph(size = 18.dp, tint = DeepSpaceBlack)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Save & View on GitHub",
                        style = MaterialTheme.typography.labelLarge,
                        color = DeepSpaceBlack
                    )
                }

                OutlinedButton(
                    onClick = {
                        showConfigSheet = false
                        CreatorIdentity.openProfile(context, CreatorIdentity.GITHUB_HOME_URL)
                    },
                    shape = CircleShape,
                    border = BorderStroke(1.dp, ElectricPurple.copy(alpha = 0.65f)),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                        .testTag("open_github_home_button")
                ) {
                    Text(
                        text = "Open GitHub (github.com)",
                        style = MaterialTheme.typography.labelLarge,
                        color = BrightViolet
                    )
                }

                if (!savedRepoUrl.isNullOrBlank()) {
                    TextButton(
                        onClick = {
                            GitHubRepoPreferences.clearRepoUrl(context)
                            draftInput = ""
                        },
                        modifier = Modifier.align(Alignment.CenterHorizontally)
                    ) {
                        Text("Clear saved repository URL", color = LavenderMuted)
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))
            }
        }
    }
}
