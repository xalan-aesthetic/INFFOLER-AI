package com.example.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp

private val WhatIfDarkColorScheme = darkColorScheme(
    primary = ElectricPurple,
    onPrimary = IceWhite,
    primaryContainer = DeepViolet,
    onPrimaryContainer = IceWhite,
    secondary = NeonCyan,
    onSecondary = DeepSpaceBlack,
    secondaryContainer = GlassPanelElevated,
    onSecondaryContainer = NeonCyan,
    tertiary = QuantumTeal,
    onTertiary = DeepSpaceBlack,
    background = DeepSpaceBlack,
    onBackground = IceWhite,
    surface = ObsidianVoid,
    onSurface = IceWhite,
    surfaceVariant = GlassPanel,
    onSurfaceVariant = LavenderMuted,
    outline = GlassBorder,
    outlineVariant = SlateDim,
    error = ErrorCrimson,
    onError = IceWhite
)

val WhatIfShapes = Shapes(
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(18.dp),
    large = RoundedCornerShape(24.dp),
    extraLarge = RoundedCornerShape(32.dp)
)

@Composable
fun ProjectWhatIfTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = WhatIfDarkColorScheme,
        typography = WhatIfTypography,
        shapes = WhatIfShapes,
        content = content
    )
}
