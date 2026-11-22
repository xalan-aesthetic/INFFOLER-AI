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
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.rounded.AddComment
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.ErrorOutline
import androidx.compose.material.icons.rounded.History
import androidx.compose.material.icons.rounded.KeyboardArrowDown
import androidx.compose.material.icons.rounded.Memory
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material3.AlertDialog
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.example.R
import com.example.ui.AiAgentModel
import com.example.ui.ChatStatus
import com.example.ui.ChatUiState
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
import com.example.ui.theme.GlassPanelElevated
import com.example.ui.theme.IceWhite
import com.example.ui.theme.LavenderMuted
import com.example.ui.theme.NeonCyan
import com.example.ui.theme.ObsidianVoid
import com.example.ui.theme.QuantumTeal

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    uiState: ChatUiState,
    onSendMessage: (String) -> Unit,
    onRetryFailed: () -> Unit,
    onNewChat: () -> Unit,
    onSelectConversation: (Long) -> Unit,
    onSelectModel: (AiAgentModel) -> Unit,
    onClearConversation: () -> Unit,
    onOpenCreatorProfile: () -> Unit,
    modifier: Modifier = Modifier
) {
    var inputText by remember { mutableStateOf("") }
    var showHistorySheet by remember { mutableStateOf(false) }
    var showModelSheet by remember { mutableStateOf(false) }
    var showClearDialog by remember { mutableStateOf(false) }

    val listState = rememberLazyListState()
    val clipboard = LocalClipboardManager.current
    val context = LocalContext.current
    val copiedToast = stringResource(R.string.copied_feedback)

    val isBusy = uiState.isGenerating
    val streamingLength = (uiState.status as? ChatStatus.Streaming)?.partialText?.length ?: 0

    // Auto-scroll smoothly to the latest message or active indicator
    LaunchedEffect(uiState.messages.size, streamingLength, uiState.status) {
        val extraRow = if (uiState.status is ChatStatus.Loading || uiState.status is ChatStatus.Error) 1 else 0
        val lastMessageIndex = uiState.messages.size + extraRow - 1
        if (lastMessageIndex >= 0) {
            listState.animateScrollToItem(lastMessageIndex)
        }
    }

    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.TopCenter
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .widthIn(max = 720.dp)
                .imePadding()
        ) {
            // Glassmorphic Chat Header with Agent Model Selector
            Surface(
                color = ObsidianVoid.copy(alpha = 0.85f),
                border = BorderStroke(1.dp, GlassBorder.copy(alpha = 0.6f)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.weight(1f)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(38.dp)
                                .clip(CircleShape)
                                .background(
                                    Brush.linearGradient(listOf(ElectricPurple, NeonCyan))
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.AutoAwesome,
                                contentDescription = null,
                                tint = DeepSpaceBlack,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = "INFFOLER AI",
                                    style = MaterialTheme.typography.titleLarge,
                                    color = IceWhite
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Surface(
                                    shape = CircleShape,
                                    color = GlassPanelElevated,
                                    border = BorderStroke(1.dp, NeonCyan.copy(alpha = 0.45f)),
                                    modifier = Modifier
                                        .clip(CircleShape)
                                        .clickable { showModelSheet = true }
                                        .testTag("model_selector_chip")
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = uiState.selectedModel.shortLabel,
                                            style = MaterialTheme.typography.labelSmall,
                                            color = NeonCyan
                                        )
                                        Icon(
                                            imageVector = Icons.Rounded.KeyboardArrowDown,
                                            contentDescription = "Select AI model",
                                            tint = NeonCyan,
                                            modifier = Modifier.size(14.dp)
                                        )
                                    }
                                }
                            }
                            Text(
                                text = when (val status = uiState.status) {
                                    is ChatStatus.Loading -> status.statusLabel.uppercase()
                                    is ChatStatus.Streaming -> "STREAMING · ${status.modelId.uppercase()}"
                                    is ChatStatus.Error -> "SIGNAL INTERRUPTED"
                                    ChatStatus.Idle -> {
                                        val activeLabel = uiState.lastResponderModelId ?: uiState.selectedModel.displayName
                                        "${activeLabel.uppercase()} · READY"
                                    }
                                },
                                style = MaterialTheme.typography.labelSmall,
                                color = if (uiState.status is ChatStatus.Error) ErrorCrimson else QuantumTeal,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(
                            onClick = { showHistorySheet = true },
                            modifier = Modifier
                                .size(48.dp)
                                .testTag("chat_history_button")
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.History,
                                contentDescription = stringResource(R.string.history_cd),
                                tint = LavenderMuted
                            )
                        }
                        IconButton(
                            onClick = onNewChat,
                            modifier = Modifier
                                .size(48.dp)
                                .testTag("new_chat_button")
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.AddComment,
                                contentDescription = stringResource(R.string.new_chat),
                                tint = NeonCyan
                            )
                        }
                        IconButton(
                            onClick = { showClearDialog = true },
                            modifier = Modifier
                                .size(48.dp)
                                .testTag("clear_chat_button")
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.DeleteOutline,
                                contentDescription = stringResource(R.string.clear_chat),
                                tint = LavenderMuted
                            )
                        }
                    }
                }
            }

            // Message Stream
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                items(uiState.messages, key = { it.id }) { msg ->
                    AnimatedVisibility(
                        visible = true,
                        enter = fadeIn() + slideInVertically { it / 4 }
                    ) {
                        if (msg.isFromUser) {
                            UserMessageBubble(text = msg.text)
                        } else {
                            AiMessageBubble(
                                text = msg.text,
                                isStreaming = msg.isStreaming,
                                onCopy = {
                                    clipboard.setText(AnnotatedString(msg.text))
                                    Toast.makeText(context, copiedToast, Toast.LENGTH_SHORT).show()
                                }
                            )
                        }
                    }
                }

                when (val status = uiState.status) {
                    is ChatStatus.Loading -> {
                        item(key = "connecting_loader") {
                            AiThinkingIndicator(label = status.statusLabel)
                        }
                    }
                    is ChatStatus.Error -> {
                        item(key = "error_card") {
                            GlassCard(
                                borderBrush = Brush.linearGradient(
                                    listOf(ErrorCrimson.copy(alpha = 0.7f), ElectricPurple.copy(alpha = 0.4f))
                                ),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(14.dp)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            imageVector = Icons.Rounded.ErrorOutline,
                                            contentDescription = null,
                                            tint = ErrorCrimson
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(
                                            text = "Transmission Error",
                                            style = MaterialTheme.typography.titleMedium,
                                            color = ErrorCrimson
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Text(
                                        text = status.message,
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = IceWhite
                                    )
                                    Spacer(modifier = Modifier.height(10.dp))
                                    Button(
                                        onClick = onRetryFailed,
                                        colors = ButtonDefaults.buttonColors(containerColor = ElectricPurple),
                                        modifier = Modifier.testTag("retry_chat_button")
                                    ) {
                                        Icon(Icons.Rounded.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text("Retry")
                                    }
                                }
                            }
                        }
                    }
                    ChatStatus.Idle, is ChatStatus.Streaming -> Unit
                }

                item(key = "chat_inffoler_footer") {
                    InffolerFooter(
                        onOpenCreatorProfile = onOpenCreatorProfile,
                        modifier = Modifier.padding(top = 12.dp)
                    )
                }
            }

            // Glassmorphic Bottom Input Bar
            Surface(
                color = ObsidianVoid.copy(alpha = 0.94f),
                border = BorderStroke(1.dp, GlassBorder),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.Bottom
                ) {
                    OutlinedTextField(
                        value = inputText,
                        onValueChange = { inputText = it },
                        placeholder = {
                            Text(
                                text = stringResource(R.string.chat_input_hint),
                                color = LavenderMuted
                            )
                        },
                        maxLines = 4,
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                        keyboardActions = KeyboardActions(
                            onSend = {
                                if (!isBusy && inputText.isNotBlank()) {
                                    onSendMessage(inputText)
                                    inputText = ""
                                }
                            }
                        ),
                        shape = RoundedCornerShape(24.dp),
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
                            .weight(1f)
                            .testTag("chat_input")
                    )

                    Spacer(modifier = Modifier.width(10.dp))

                    val canSend = !isBusy && inputText.isNotBlank()
                    Box(
                        modifier = Modifier
                            .size(52.dp)
                            .clip(CircleShape)
                            .background(
                                brush = if (canSend) {
                                    Brush.linearGradient(listOf(ElectricPurple, NeonCyan))
                                } else {
                                    Brush.linearGradient(listOf(GlassPanelElevated, GlassPanelElevated))
                                }
                            )
                            .clickable(enabled = canSend) {
                                onSendMessage(inputText)
                                inputText = ""
                            }
                            .testTag("send_button"),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Rounded.Send,
                            contentDescription = stringResource(R.string.send_cd),
                            tint = if (canSend) DeepSpaceBlack else LavenderMuted
                        )
                    }
                }
            }
        }
    }

    if (showModelSheet) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { showModelSheet = false },
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
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Rounded.Memory,
                        contentDescription = null,
                        tint = NeonCyan
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = "Select AI Agent Model",
                            style = MaterialTheme.typography.titleLarge,
                            color = IceWhite
                        )
                        Text(
                            text = "Choose the Gemini neural engine answering your questions",
                            style = MaterialTheme.typography.bodyMedium,
                            color = LavenderMuted
                        )
                    }
                }
                HorizontalDivider(color = GlassBorder)

                AiAgentModel.entries.forEach { agentModel ->
                    val isSelected = agentModel == uiState.selectedModel
                    GlassCard(
                        borderBrush = Brush.linearGradient(
                            if (isSelected) {
                                listOf(NeonCyan, ElectricPurple)
                            } else {
                                listOf(GlassBorder, GlassBorder)
                            }
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                onSelectModel(agentModel)
                                showModelSheet = false
                            }
                            .testTag("select_model_${agentModel.name.lowercase()}")
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = agentModel.displayName,
                                        style = MaterialTheme.typography.titleMedium,
                                        color = if (isSelected) NeonCyan else IceWhite
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = agentModel.badge,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = QuantumTeal
                                    )
                                }
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = agentModel.description,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = LavenderMuted
                                )
                            }
                            if (isSelected) {
                                Spacer(modifier = Modifier.width(8.dp))
                                Icon(
                                    imageVector = Icons.Rounded.CheckCircle,
                                    contentDescription = "Selected model",
                                    tint = NeonCyan
                                )
                            }
                        }
                    }
                }
                Spacer(modifier = Modifier.height(18.dp))
            }
        }
    }

    if (showClearDialog) {
        AlertDialog(
            onDismissRequest = { showClearDialog = false },
            containerColor = ObsidianVoid,
            titleContentColor = IceWhite,
            textContentColor = LavenderMuted,
            title = { Text("Clear Conversation?") },
            text = { Text("This removes all messages in the current chat thread and resets the greeting.") },
            confirmButton = {
                TextButton(onClick = {
                    showClearDialog = false
                    onClearConversation()
                }) {
                    Text("Clear", color = ErrorCrimson)
                }
            },
            dismissButton = {
                TextButton(onClick = { showClearDialog = false }) {
                    Text("Cancel", color = NeonCyan)
                }
            }
        )
    }

    if (showHistorySheet) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { showHistorySheet = false },
            sheetState = sheetState,
            containerColor = ObsidianVoid,
            contentColor = IceWhite
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 8.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Chat History",
                        style = MaterialTheme.typography.titleLarge,
                        color = IceWhite
                    )
                    TextButton(onClick = {
                        showHistorySheet = false
                        onNewChat()
                    }) {
                        Text("+ New Chat", color = NeonCyan)
                    }
                }
                HorizontalDivider(color = GlassBorder)
                Spacer(modifier = Modifier.height(8.dp))
                if (uiState.conversations.isEmpty()) {
                    Text(
                        text = "No saved conversations yet.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = LavenderMuted,
                        modifier = Modifier.padding(vertical = 18.dp)
                    )
                } else {
                    uiState.conversations.take(12).forEach { conv ->
                        val isCurrent = conv.id == uiState.activeConversationId
                        ListItem(
                            headlineContent = {
                                Text(
                                    text = conv.title,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    color = if (isCurrent) NeonCyan else IceWhite
                                )
                            },
                            supportingContent = {
                                Text(
                                    text = conv.preview,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    color = LavenderMuted
                                )
                            },
                            colors = ListItemDefaults.colors(containerColor = Color.Transparent),
                            modifier = Modifier.clickable {
                                showHistorySheet = false
                                onSelectConversation(conv.id)
                            }
                        )
                    }
                }
                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

@Composable
private fun UserMessageBubble(text: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.End
    ) {
        Box(
            modifier = Modifier
                .widthIn(max = 310.dp)
                .clip(
                    RoundedCornerShape(
                        topStart = 20.dp,
                        topEnd = 20.dp,
                        bottomStart = 20.dp,
                        bottomEnd = 6.dp
                    )
                )
                .background(
                    Brush.linearGradient(listOf(DeepViolet, ElectricPurple))
                )
                .padding(horizontal = 16.dp, vertical = 12.dp)
        ) {
            Text(
                text = text,
                style = MaterialTheme.typography.bodyLarge,
                color = IceWhite
            )
        }
    }
}

@Composable
private fun AiMessageBubble(
    text: String,
    isStreaming: Boolean,
    onCopy: () -> Unit
) {
    val cursorTransition = rememberInfiniteTransition(label = "typing_cursor")
    val cursorAlpha by cursorTransition.animateFloat(
        initialValue = 0.1f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(550, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "cursor_alpha"
    )

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Start
    ) {
        GlassCard(
            shape = RoundedCornerShape(
                topStart = 6.dp,
                topEnd = 20.dp,
                bottomStart = 20.dp,
                bottomEnd = 20.dp
            ),
            borderBrush = Brush.linearGradient(
                listOf(NeonCyan.copy(alpha = 0.55f), ElectricPurple.copy(alpha = 0.35f))
            ),
            modifier = Modifier.widthIn(max = 340.dp)
        ) {
            Column(modifier = Modifier.padding(horizontal = 15.dp, vertical = 12.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "INFFOLER AI",
                        style = MaterialTheme.typography.labelSmall,
                        color = NeonCyan
                    )
                    if (!isStreaming) {
                        IconButton(
                            onClick = onCopy,
                            modifier = Modifier
                                .size(36.dp)
                                .testTag("copy_ai_response")
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.ContentCopy,
                                contentDescription = stringResource(R.string.copy_response),
                                tint = LavenderMuted,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = if (isStreaming) "$text ▍" else text,
                    style = MaterialTheme.typography.bodyLarge,
                    color = IceWhite,
                    modifier = Modifier.alpha(if (isStreaming) 0.96f else 1f)
                )
                if (isStreaming) {
                    Spacer(modifier = Modifier.height(6.dp))
                    Box(
                        modifier = Modifier
                            .size(width = 36.dp, height = 3.dp)
                            .clip(CircleShape)
                            .background(NeonCyan.copy(alpha = cursorAlpha))
                    )
                }
            }
        }
    }
}

@Composable
private fun AiThinkingIndicator(label: String = "Synthesizing…") {
    val transition = rememberInfiniteTransition(label = "ai_thinking")
    val pulse by transition.animateFloat(
        initialValue = 0.35f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(650),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse"
    )

    GlassCard(
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier.widthIn(max = 280.dp)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            repeat(3) { index ->
                val dotColor = when (index) {
                    0 -> ElectricPurple
                    1 -> ElectricBlue
                    else -> NeonCyan
                }
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(dotColor.copy(alpha = ((pulse + index * 0.2f) % 1f).coerceIn(0.3f, 1f)))
                )
            }
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = BrightViolet,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}
