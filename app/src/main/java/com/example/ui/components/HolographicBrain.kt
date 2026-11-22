package com.example.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.ripple
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.example.R
import com.example.ui.theme.BrightViolet
import com.example.ui.theme.ElectricBlue
import com.example.ui.theme.ElectricPurple
import com.example.ui.theme.IceWhite
import com.example.ui.theme.NeonCyan
import com.example.ui.theme.QuantumMagenta
import com.example.ui.theme.QuantumTeal
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

private data class NeuralNode3D(
    val x: Float,
    val y: Float,
    val z: Float,
    val hemisphere: Int, // -1 left, 1 right, 0 core
    val weight: Float
)

private data class SynapticEdge(
    val from: Int,
    val to: Int,
    val speed: Float,
    val phaseOffset: Float
)

private data class OrbitParticle(
    val angleOffset: Float,
    val radiusFactor: Float,
    val verticalTilt: Float,
    val speed: Float,
    val sizeDp: Float,
    val isCyan: Boolean
)

private data class ProjectedNode(
    val x: Float,
    val y: Float,
    val z: Float,
    val scale: Float,
    val hemisphere: Int,
    val weight: Float
)

@Composable
fun HolographicBrain(
    isActivating: Boolean,
    onBrainTap: () -> Unit,
    modifier: Modifier = Modifier
) {
    val brainDescription = stringResource(R.string.brain_cd)

    val infiniteTransition = rememberInfiniteTransition(label = "brain_core")

    // Smooth 3D rotation
    val rotationPhase by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = (2f * PI).toFloat(),
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 16000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "rotation"
    )

    // Breathing & floating levitation
    val breathPhase by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = (2f * PI).toFloat(),
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 3600, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "breath"
    )

    // Traveling synaptic pulse phase
    val pulsePhase by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 2800, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "synapse_pulse"
    )

    // Orbital ring rotation
    val ringPhase by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = (2f * PI).toFloat(),
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 9000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "rings"
    )

    // Interactive tap activation burst (glow + expanding circular ripples)
    val activationProgress = remember { Animatable(0f) }
    LaunchedEffect(isActivating) {
        if (isActivating) {
            activationProgress.snapTo(0f)
            activationProgress.animateTo(
                targetValue = 1f,
                animationSpec = tween(durationMillis = 620, easing = FastOutSlowInEasing)
            )
        } else {
            activationProgress.snapTo(0f)
        }
    }

    // Pre-computed 3D anatomical bilateral brain node cloud
    val neuralNetwork = remember { buildBrainNetwork() }
    val particles = remember { buildOrbitParticles() }
    val projectedBuffer = remember(neuralNetwork.first.size) {
        Array(neuralNetwork.first.size) { ProjectedNode(0f, 0f, 0f, 1f, 0, 1f) }
    }

    val interactionSource = remember { MutableInteractionSource() }

    Box(
        modifier = modifier
            .testTag("brain_hero_canvas")
            .semantics { contentDescription = brainDescription }
            .clip(CircleShape)
            .clickable(
                interactionSource = interactionSource,
                indication = ripple(bounded = false, color = NeonCyan),
                onClick = onBrainTap
            ),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val minDim = size.minDimension
            val centerX = size.width * 0.5f
            val floatOffsetY = sin(breathPhase) * (minDim * 0.022f)
            val centerY = size.height * 0.5f + floatOffsetY

            val breathScale = 1f + 0.032f * sin(breathPhase)
            val activeBoost = activationProgress.value
            val overdriveScale = 1f + activeBoost * 0.14f
            val brainRadius = minDim * 0.28f * breathScale * overdriveScale

            val glowIntensity = 1f + activeBoost * 1.4f

            // 1. Soft multi-layered glowing aura
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(
                        ElectricPurple.copy(alpha = (0.36f * glowIntensity).coerceAtMost(0.85f)),
                        NeonCyan.copy(alpha = (0.18f * glowIntensity).coerceAtMost(0.6f)),
                        Color.Transparent
                    ),
                    center = Offset(centerX, centerY),
                    radius = minDim * 0.48f
                ),
                radius = minDim * 0.48f,
                center = Offset(centerX, centerY)
            )

            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(
                        NeonCyan.copy(alpha = (0.28f * glowIntensity).coerceAtMost(0.75f)),
                        ElectricPurple.copy(alpha = 0.12f),
                        Color.Transparent
                    ),
                    center = Offset(centerX, centerY),
                    radius = brainRadius * 1.35f
                ),
                radius = brainRadius * 1.35f,
                center = Offset(centerX, centerY)
            )

            // 2. Tilted 3D circular energy rings around the brain
            val ringConfigs = listOf(
                Triple(minDim * 0.38f, 0.34f, -0.45f + ringPhase * 0.15f),
                Triple(minDim * 0.41f, 0.28f, 0.52f - ringPhase * 0.12f),
                Triple(minDim * 0.44f, 0.42f, 0.08f + sin(ringPhase) * 0.12f)
            )
            ringConfigs.forEachIndexed { idx, (rRadius, squash, tilt) ->
                val segments = 56
                val ringColor = when (idx) {
                    0 -> NeonCyan
                    1 -> ElectricPurple
                    else -> ElectricBlue
                }
                val ringAlpha = (0.32f + 0.14f * sin(breathPhase + idx)).coerceIn(0.15f, 0.85f) *
                    (1f + activeBoost * 0.6f)

                var prevPt: Offset? = null
                for (s in 0..segments) {
                    val theta = (s.toFloat() / segments) * (2f * PI).toFloat() + ringPhase * (if (idx == 1) -1f else 1f)
                    val rx = cos(theta) * rRadius
                    val ry = sin(theta) * rRadius * squash
                    val rotX = rx * cos(tilt) - ry * sin(tilt)
                    val rotY = rx * sin(tilt) + ry * cos(tilt)
                    val pt = Offset(centerX + rotX, centerY + rotY)
                    if (prevPt != null) {
                        val depthAlpha = ((sin(theta) + 1.4f) / 2.4f) * ringAlpha
                        drawLine(
                            color = ringColor.copy(alpha = depthAlpha.coerceIn(0.06f, 0.9f)),
                            start = prevPt,
                            end = pt,
                            strokeWidth = if (idx == 0) 2.2f else 1.5f,
                            cap = StrokeCap.Round
                        )
                    }
                    prevPt = pt
                }

                // Orbiting energy node on each ring
                val orbAngle = ringPhase * (1.2f + idx * 0.4f) + idx * 2.1f
                val ox = cos(orbAngle) * rRadius
                val oy = sin(orbAngle) * rRadius * squash
                val orbRotX = ox * cos(tilt) - oy * sin(tilt)
                val orbRotY = ox * sin(tilt) + oy * cos(tilt)
                val orbPos = Offset(centerX + orbRotX, centerY + orbRotY)
                drawCircle(
                    color = ringColor.copy(alpha = 0.45f),
                    radius = 9f,
                    center = orbPos
                )
                drawCircle(
                    color = IceWhite,
                    radius = 3.5f,
                    center = orbPos
                )
            }

            // 3. Project 3D brain nodes into 2D screen coordinates
            val yaw = rotationPhase * 0.65f + activeBoost * 1.3f
            val pitch = sin(breathPhase * 0.5f) * 0.16f
            val cosY = cos(yaw)
            val sinY = sin(yaw)
            val cosP = cos(pitch)
            val sinP = sin(pitch)
            val focalLength = 3.2f

            val nodes = neuralNetwork.first
            val edges = neuralNetwork.second

            for (i in nodes.indices) {
                val n = nodes[i]
                // Rotate around Y then X
                val x1 = n.x * cosY - n.z * sinY
                val z1 = n.x * sinY + n.z * cosY
                val y2 = n.y * cosP - z1 * sinP
                val z2 = n.y * sinP + z1 * cosP

                val perspective = focalLength / (focalLength - z2 * 0.85f)
                projectedBuffer[i] = ProjectedNode(
                    x = centerX + x1 * brainRadius * perspective,
                    y = centerY + y2 * brainRadius * perspective,
                    z = z2,
                    scale = perspective,
                    hemisphere = n.hemisphere,
                    weight = n.weight
                )
            }

            // 4. Draw animated neural network connections & moving electric pulses
            edges.forEach { edge ->
                val a = projectedBuffer[edge.from]
                val b = projectedBuffer[edge.to]
                val avgDepth = ((a.z + b.z) * 0.5f + 1.1f) / 2.2f
                val depthAlpha = avgDepth.coerceIn(0.18f, 0.92f)

                val baseColor = when {
                    a.hemisphere < 0 && b.hemisphere < 0 -> ElectricPurple
                    a.hemisphere > 0 && b.hemisphere > 0 -> NeonCyan
                    else -> lerp(ElectricPurple, NeonCyan, 0.5f)
                }

                val lineColor = lerp(baseColor, IceWhite, activeBoost * 0.45f)
                drawLine(
                    color = lineColor.copy(alpha = (depthAlpha * 0.52f).coerceIn(0.1f, 0.9f)),
                    start = Offset(a.x, a.y),
                    end = Offset(b.x, b.y),
                    strokeWidth = (1.6f * ((a.scale + b.scale) * 0.5f)).coerceIn(1f, 3.2f),
                    cap = StrokeCap.Round
                )

                // Traveling neural impulse along this synapse
                val t = (pulsePhase * edge.speed + edge.phaseOffset) % 1f
                val px = a.x + (b.x - a.x) * t
                val py = a.y + (b.y - a.y) * t
                val impulseAlpha = (sin(t * PI.toFloat()) * depthAlpha).coerceIn(0f, 1f)
                if (impulseAlpha > 0.15f) {
                    val pulseColor = if (a.hemisphere <= 0) NeonCyan else BrightViolet
                    drawCircle(
                        color = pulseColor.copy(alpha = impulseAlpha * 0.45f),
                        radius = 6.5f,
                        center = Offset(px, py)
                    )
                    drawCircle(
                        color = IceWhite.copy(alpha = impulseAlpha),
                        radius = 2.4f,
                        center = Offset(px, py)
                    )
                }
            }

            // 5. Draw glowing 3D neural nodes sorted back-to-front
            val sortedIndices = nodes.indices.sortedBy { projectedBuffer[it].z }
            sortedIndices.forEach { idx ->
                val p = projectedBuffer[idx]
                val depthNorm = ((p.z + 1f) * 0.5f).coerceIn(0.15f, 1f)
                val nodeColor = when {
                    p.hemisphere < 0 -> lerp(ElectricPurple, BrightViolet, depthNorm)
                    p.hemisphere > 0 -> lerp(ElectricBlue, NeonCyan, depthNorm)
                    else -> QuantumTeal
                }
                val finalColor = lerp(nodeColor, IceWhite, activeBoost * 0.5f)
                val radius = (4.2f + p.weight * 2.8f) * p.scale * (1f + activeBoost * 0.25f)

                // Outer halo
                drawCircle(
                    color = finalColor.copy(alpha = (0.28f * depthNorm * glowIntensity).coerceAtMost(0.75f)),
                    radius = radius * 2.4f,
                    center = Offset(p.x, p.y)
                )
                // Bright core
                drawCircle(
                    color = finalColor.copy(alpha = (0.75f + depthNorm * 0.25f).coerceAtMost(1f)),
                    radius = radius,
                    center = Offset(p.x, p.y)
                )
                // Specular highlight
                drawCircle(
                    color = IceWhite.copy(alpha = 0.85f * depthNorm),
                    radius = radius * 0.42f,
                    center = Offset(p.x - radius * 0.2f, p.y - radius * 0.2f)
                )
            }

            // 6. Floating light particles around the brain
            particles.forEach { pt ->
                val theta = pt.angleOffset + rotationPhase * pt.speed
                val r = minDim * pt.radiusFactor * (1f + 0.04f * sin(breathPhase + pt.angleOffset))
                val x = centerX + cos(theta) * r
                val y = centerY + sin(theta * 1.15f) * r * pt.verticalTilt
                val twinkle = 0.35f + 0.65f * ((sin(breathPhase * 1.5f + pt.angleOffset * 3f) + 1f) * 0.5f)
                val pColor = if (pt.isCyan) NeonCyan else QuantumMagenta
                val pRadius = pt.sizeDp.dp.toPx()

                drawCircle(
                    color = pColor.copy(alpha = twinkle * 0.35f),
                    radius = pRadius * 2.2f,
                    center = Offset(x, y)
                )
                drawCircle(
                    color = IceWhite.copy(alpha = twinkle * 0.85f),
                    radius = pRadius * 0.8f,
                    center = Offset(x, y)
                )
            }

            // 7. Expanding circular shockwave ripples on brain tap / activation
            if (activeBoost > 0.01f) {
                val ripple1Radius = minDim * (0.18f + activeBoost * 0.34f)
                val ripple1Alpha = (1f - activeBoost).coerceIn(0f, 1f)
                drawCircle(
                    color = NeonCyan.copy(alpha = ripple1Alpha * 0.85f),
                    radius = ripple1Radius,
                    center = Offset(centerX, centerY),
                    style = Stroke(width = 4.dp.toPx() * (1f - activeBoost * 0.6f))
                )

                val delayed = ((activeBoost - 0.18f) / 0.82f).coerceIn(0f, 1f)
                if (delayed > 0f) {
                    val ripple2Radius = minDim * (0.16f + delayed * 0.36f)
                    val ripple2Alpha = (1f - delayed).coerceIn(0f, 1f)
                    drawCircle(
                        color = ElectricPurple.copy(alpha = ripple2Alpha * 0.9f),
                        radius = ripple2Radius,
                        center = Offset(centerX, centerY),
                        style = Stroke(
                            width = 3.dp.toPx(),
                            pathEffect = PathEffect.dashPathEffect(floatArrayOf(18f, 10f), 0f)
                        )
                    )
                }

                // Central activation flash
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(
                            IceWhite.copy(alpha = (1f - activeBoost) * 0.55f),
                            NeonCyan.copy(alpha = (1f - activeBoost) * 0.35f),
                            Color.Transparent
                        ),
                        center = Offset(centerX, centerY),
                        radius = minDim * 0.3f
                    ),
                    radius = minDim * 0.3f,
                    center = Offset(centerX, centerY)
                )
            }
        }
    }
}

private fun buildBrainNetwork(): Pair<List<NeuralNode3D>, List<SynapticEdge>> {
    val nodes = mutableListOf<NeuralNode3D>()

    // Generate two symmetrical anatomical brain hemispheres + deep core + brainstem
    val hemisphereTemplates = listOf(
        // Upper frontal & parietal cortex
        Triple(0.24f, -0.62f, 0.36f),
        Triple(0.46f, -0.54f, 0.22f),
        Triple(0.58f, -0.34f, 0.14f),
        Triple(0.22f, -0.58f, -0.18f),
        Triple(0.48f, -0.46f, -0.26f),
        Triple(0.56f, -0.22f, -0.36f),
        // Mid cerebral cortex & temporal lobes
        Triple(0.76f, -0.12f, 0.22f),
        Triple(0.84f, 0.08f, 0.04f),
        Triple(0.72f, 0.28f, 0.18f),
        Triple(0.68f, 0.16f, -0.34f),
        Triple(0.48f, -0.08f, 0.52f),
        Triple(0.32f, 0.12f, 0.62f),
        Triple(0.46f, 0.14f, -0.52f),
        Triple(0.26f, -0.12f, -0.60f),
        // Lower occipital / cerebellum curve
        Triple(0.54f, 0.44f, -0.12f),
        Triple(0.38f, 0.56f, -0.32f),
        Triple(0.28f, 0.46f, 0.34f),
        Triple(0.18f, 0.26f, -0.02f),
        // Inner corpus callosum bridge nodes
        Triple(0.14f, -0.28f, 0.14f),
        Triple(0.14f, -0.22f, -0.20f)
    )

    // Left hemisphere (-1)
    hemisphereTemplates.forEachIndexed { idx, (x, y, z) ->
        nodes.add(
            NeuralNode3D(
                x = -x - 0.06f,
                y = y,
                z = z,
                hemisphere = -1,
                weight = if (idx % 3 == 0) 1.2f else 0.85f
            )
        )
    }

    // Right hemisphere (+1)
    hemisphereTemplates.forEachIndexed { idx, (x, y, z) ->
        nodes.add(
            NeuralNode3D(
                x = x + 0.06f,
                y = y,
                z = z,
                hemisphere = 1,
                weight = if (idx % 3 == 0) 1.2f else 0.85f
            )
        )
    }

    // Central thalamus & brainstem core (0)
    nodes.add(NeuralNode3D(0f, -0.10f, 0.04f, hemisphere = 0, weight = 1.45f))
    nodes.add(NeuralNode3D(0f, 0.22f, -0.08f, hemisphere = 0, weight = 1.15f))
    nodes.add(NeuralNode3D(0f, 0.58f, -0.14f, hemisphere = 0, weight = 1.0f))

    val edges = mutableListOf<SynapticEdge>()
    var edgeCounter = 0

    // Connect nearby nodes in 3D space + selective cross-hemisphere corpus callosum links
    for (i in nodes.indices) {
        for (j in i + 1 until nodes.size) {
            val a = nodes[i]
            val b = nodes[j]
            val dx = a.x - b.x
            val dy = a.y - b.y
            val dz = a.z - b.z
            val dist = sqrt(dx * dx + dy * dy + dz * dz)

            val sameSide = a.hemisphere == b.hemisphere
            val threshold = if (sameSide) 0.52f else 0.42f
            if (dist < threshold) {
                edgeCounter++
                edges.add(
                    SynapticEdge(
                        from = i,
                        to = j,
                        speed = 0.8f + (edgeCounter % 5) * 0.25f,
                        phaseOffset = (edgeCounter * 0.17f) % 1f
                    )
                )
            }
        }
    }

    return nodes to edges
}

private fun buildOrbitParticles(): List<OrbitParticle> {
    return List(26) { idx ->
        OrbitParticle(
            angleOffset = (idx * 0.47f),
            radiusFactor = 0.34f + (idx % 6) * 0.03f,
            verticalTilt = 0.65f + (idx % 4) * 0.1f,
            speed = (if (idx % 2 == 0) 1f else -1f) * (0.35f + (idx % 5) * 0.12f),
            sizeDp = 1.5f + (idx % 3) * 0.8f,
            isCyan = idx % 2 == 0
        )
    }
}
