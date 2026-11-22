package com.example.ui

import android.widget.Toast
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Explore
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Memory
import androidx.compose.material.icons.outlined.WorkspacePremium
import androidx.compose.material.icons.rounded.Explore
import androidx.compose.material.icons.rounded.History
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Memory
import androidx.compose.material.icons.rounded.WorkspacePremium
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.NavigationRailItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.example.R
import com.example.ui.components.FuturisticBackground
import com.example.ui.screens.ChatScreen
import com.example.ui.screens.ConversationsScreen
import com.example.ui.screens.CoreScreen
import com.example.ui.screens.CreatorProfileScreen
import com.example.ui.screens.ExploreScreen
import com.example.ui.screens.HomeScreen
import com.example.ui.screens.MoreScreen
import com.example.ui.screens.WhatIfModeScreen
import com.example.ui.theme.ElectricBlue
import com.example.ui.theme.ElectricPurple
import com.example.ui.theme.GlassPanelElevated
import com.example.ui.theme.IceWhite
import com.example.ui.theme.LavenderMuted
import com.example.ui.theme.NeonCyan
import com.example.ui.theme.ObsidianVoid

private object WhatIfRoutes {
    const val HOME = "home"
    const val CORE = "core"
    const val EXPLORE = "explore"
    const val CONVERSATIONS = "conversations"
    const val MORE = "more"
    const val CHAT = "chat"
    const val WHAT_IF = "what_if"
    const val CREATOR = "creator"
}

private data class NavDestinationItem(
    val route: String,
    val labelRes: Int,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector,
    val testTag: String
)

private val navItems = listOf(
    NavDestinationItem(
        route = WhatIfRoutes.HOME,
        labelRes = R.string.nav_home,
        selectedIcon = Icons.Rounded.Home,
        unselectedIcon = Icons.Outlined.Home,
        testTag = "nav_home"
    ),
    NavDestinationItem(
        route = WhatIfRoutes.CORE,
        labelRes = R.string.nav_core,
        selectedIcon = Icons.Rounded.Memory,
        unselectedIcon = Icons.Outlined.Memory,
        testTag = "nav_core"
    ),
    NavDestinationItem(
        route = WhatIfRoutes.EXPLORE,
        labelRes = R.string.nav_explore,
        selectedIcon = Icons.Rounded.Explore,
        unselectedIcon = Icons.Outlined.Explore,
        testTag = "nav_explore"
    ),
    NavDestinationItem(
        route = WhatIfRoutes.CONVERSATIONS,
        labelRes = R.string.nav_conversations,
        selectedIcon = Icons.Rounded.History,
        unselectedIcon = Icons.Outlined.History,
        testTag = "nav_conversations"
    ),
    NavDestinationItem(
        route = WhatIfRoutes.MORE,
        labelRes = R.string.nav_more,
        selectedIcon = Icons.Rounded.WorkspacePremium,
        unselectedIcon = Icons.Outlined.WorkspacePremium,
        testTag = "nav_more"
    )
)

@Composable
fun WhatIfApp(
    chatViewModel: ChatViewModel = viewModel(),
    whatIfViewModel: WhatIfViewModel = viewModel()
) {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route ?: WhatIfRoutes.HOME

    val greeting = stringResource(R.string.chat_greeting)
    val context = LocalContext.current
    val chatUiState by chatViewModel.uiState.collectAsStateWithLifecycle()
    val conversations by whatIfViewModel.conversations.collectAsStateWithLifecycle()
    val simulations by whatIfViewModel.simulations.collectAsStateWithLifecycle()
    val simulationUiState by whatIfViewModel.simulationUiState.collectAsStateWithLifecycle()
    val whatIfDraft by whatIfViewModel.whatIfDraft.collectAsStateWithLifecycle()

    val navigateTo: (String) -> Unit = { route ->
        navController.navigate(route) {
            popUpTo(navController.graph.findStartDestination().id) {
                saveState = true
            }
            launchSingleTop = true
            restoreState = true
        }
    }

    val handleClearAppCache: () -> Unit = {
        chatViewModel.clearModelCache()
        whatIfViewModel.clearAppCache { freedBytes ->
            val freedKb = freedBytes / 1024L
            val msg = if (freedKb > 0) {
                "App cache cleared (${freedKb} KB freed)"
            } else {
                "App cache cleared"
            }
            Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
        }
    }

    val handleClearAllLocalData: () -> Unit = {
        chatViewModel.resetAll()
        whatIfViewModel.clearAllLocalHistory()
        Toast.makeText(context, "Local conversation storage cleared", Toast.LENGTH_SHORT).show()
    }

    FuturisticBackground {
        BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
            val useNavRail = maxWidth >= 600.dp

            Scaffold(
                containerColor = Color.Transparent,
                contentWindowInsets = WindowInsets.safeDrawing,
                bottomBar = {
                    if (!useNavRail) {
                        Column(
                            modifier = Modifier.background(
                                Brush.verticalGradient(
                                    listOf(
                                        ObsidianVoid.copy(alpha = 0.92f),
                                        ObsidianVoid.copy(alpha = 0.98f)
                                    )
                                )
                            )
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(1.5.dp)
                                    .background(
                                        Brush.horizontalGradient(
                                            listOf(
                                                ElectricPurple.copy(alpha = 0.25f),
                                                ElectricPurple.copy(alpha = 0.85f),
                                                NeonCyan.copy(alpha = 0.85f),
                                                ElectricBlue.copy(alpha = 0.25f)
                                            )
                                        )
                                    )
                            )
                            NavigationBar(
                                containerColor = Color.Transparent,
                                windowInsets = WindowInsets.navigationBars,
                                tonalElevation = 0.dp
                            ) {
                                navItems.forEach { item ->
                                    val selected = currentRoute == item.route ||
                                        (item.route == WhatIfRoutes.MORE &&
                                            (currentRoute == WhatIfRoutes.CREATOR ||
                                                currentRoute == WhatIfRoutes.CHAT ||
                                                currentRoute == WhatIfRoutes.WHAT_IF))
                                    NavigationBarItem(
                                        selected = selected,
                                        onClick = { navigateTo(item.route) },
                                        icon = {
                                            Icon(
                                                imageVector = if (selected) item.selectedIcon else item.unselectedIcon,
                                                contentDescription = stringResource(item.labelRes)
                                            )
                                        },
                                        label = {
                                            Text(
                                                text = stringResource(item.labelRes),
                                                maxLines = 1,
                                                softWrap = false,
                                                overflow = TextOverflow.Ellipsis,
                                                style = MaterialTheme.typography.labelSmall.copy(
                                                    fontSize = 10.sp,
                                                    letterSpacing = 0.2.sp
                                                )
                                            )
                                        },
                                        colors = NavigationBarItemDefaults.colors(
                                            selectedIconColor = IceWhite,
                                            selectedTextColor = NeonCyan,
                                            indicatorColor = ElectricPurple.copy(alpha = 0.45f),
                                            unselectedIconColor = LavenderMuted,
                                            unselectedTextColor = LavenderMuted
                                        ),
                                        modifier = Modifier.testTag(item.testTag)
                                    )
                                }
                            }
                        }
                    }
                }
            ) { innerPadding ->
                Row(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(innerPadding)
                ) {
                    if (useNavRail) {
                        NavigationRail(
                            containerColor = ObsidianVoid.copy(alpha = 0.92f),
                            modifier = Modifier
                                .fillMaxHeight()
                                .windowInsetsPadding(WindowInsets.navigationBars)
                        ) {
                            navItems.forEach { item ->
                                val selected = currentRoute == item.route ||
                                    (item.route == WhatIfRoutes.MORE &&
                                        (currentRoute == WhatIfRoutes.CREATOR ||
                                            currentRoute == WhatIfRoutes.CHAT ||
                                            currentRoute == WhatIfRoutes.WHAT_IF))
                                NavigationRailItem(
                                    selected = selected,
                                    onClick = { navigateTo(item.route) },
                                    icon = {
                                        Icon(
                                            imageVector = if (selected) item.selectedIcon else item.unselectedIcon,
                                            contentDescription = stringResource(item.labelRes)
                                        )
                                    },
                                    label = {
                                        Text(
                                            text = stringResource(item.labelRes),
                                            maxLines = 1,
                                            style = MaterialTheme.typography.labelSmall
                                        )
                                    },
                                    colors = NavigationRailItemDefaults.colors(
                                        selectedIconColor = NeonCyan,
                                        selectedTextColor = NeonCyan,
                                        indicatorColor = GlassPanelElevated,
                                        unselectedIconColor = LavenderMuted,
                                        unselectedTextColor = LavenderMuted
                                    ),
                                    modifier = Modifier.testTag(item.testTag)
                                )
                            }
                        }
                    }

                    Box(modifier = Modifier.weight(1f).fillMaxHeight()) {
                        NavHost(
                            navController = navController,
                            startDestination = WhatIfRoutes.HOME,
                            enterTransition = { fadeIn() },
                            exitTransition = { fadeOut() }
                        ) {
                            composable(WhatIfRoutes.HOME) {
                                HomeScreen(
                                    onSubmitPrompt = { prompt ->
                                        chatViewModel.startNewChat(greeting, initialPrompt = prompt)
                                        navigateTo(WhatIfRoutes.CHAT)
                                    },
                                    onOpenCore = {
                                        navigateTo(WhatIfRoutes.CORE)
                                    },
                                    onOpenChat = {
                                        chatViewModel.ensureActiveConversation(greeting)
                                        navigateTo(WhatIfRoutes.CHAT)
                                    },
                                    onOpenWhatIfMode = {
                                        navigateTo(WhatIfRoutes.WHAT_IF)
                                    },
                                    onLaunchRandomWhatIf = { question ->
                                        whatIfViewModel.setWhatIfDraft(question)
                                        whatIfViewModel.runSimulation(question)
                                        navigateTo(WhatIfRoutes.WHAT_IF)
                                    },
                                    onOpenExplore = {
                                        navigateTo(WhatIfRoutes.EXPLORE)
                                    },
                                    onOpenCreatorProfile = {
                                        navigateTo(WhatIfRoutes.CREATOR)
                                    },
                                    onClearAppCache = handleClearAppCache,
                                    onClearAllLocalData = handleClearAllLocalData
                                )
                            }

                            composable(WhatIfRoutes.CORE) {
                                CoreScreen(
                                    onActivateAi = {
                                        chatViewModel.startNewChat(greeting)
                                        navigateTo(WhatIfRoutes.CHAT)
                                    },
                                    onStartNewChat = {
                                        chatViewModel.startNewChat(greeting)
                                        navigateTo(WhatIfRoutes.CHAT)
                                    },
                                    onOpenWhatIfMode = {
                                        navigateTo(WhatIfRoutes.WHAT_IF)
                                    },
                                    onOpenCreatorProfile = {
                                        navigateTo(WhatIfRoutes.CREATOR)
                                    },
                                    onClearAppCache = handleClearAppCache,
                                    onClearAllLocalData = handleClearAllLocalData
                                )
                            }

                            composable(WhatIfRoutes.CHAT) {
                                ChatScreen(
                                    uiState = chatUiState,
                                    onSendMessage = { prompt ->
                                        chatViewModel.sendMessage(prompt, greeting)
                                    },
                                    onRetryFailed = {
                                        chatViewModel.retryLastFailedMessage()
                                    },
                                    onNewChat = {
                                        chatViewModel.startNewChat(greeting)
                                    },
                                    onSelectConversation = { id ->
                                        chatViewModel.selectConversation(id)
                                    },
                                    onSelectModel = chatViewModel::selectModel,
                                    onClearConversation = {
                                        chatViewModel.clearCurrentConversation(greeting)
                                    },
                                    onOpenCreatorProfile = {
                                        navigateTo(WhatIfRoutes.CREATOR)
                                    }
                                )
                            }

                            composable(WhatIfRoutes.WHAT_IF) {
                                WhatIfModeScreen(
                                    draftQuestion = whatIfDraft,
                                    uiState = simulationUiState,
                                    onDraftChange = whatIfViewModel::setWhatIfDraft,
                                    onRunSimulation = whatIfViewModel::runSimulation,
                                    onDiscussInChat = { sim ->
                                        val followUp = "Let's explore my WHAT IF simulation further: '${sim.question}'. " +
                                            "Based on the initial scenario (${sim.initialScenario.take(180)}…), " +
                                            "what is the single most surprising cascading effect most people miss?"
                                        chatViewModel.startNewChat(greeting, initialPrompt = followUp)
                                        navigateTo(WhatIfRoutes.CHAT)
                                    },
                                    onOpenCreatorProfile = {
                                        navigateTo(WhatIfRoutes.CREATOR)
                                    }
                                )
                            }

                            composable(WhatIfRoutes.EXPLORE) {
                                ExploreScreen(
                                    onLaunchChatPrompt = { prompt ->
                                        chatViewModel.startNewChat(greeting, initialPrompt = prompt)
                                        navigateTo(WhatIfRoutes.CHAT)
                                    },
                                    onLaunchWhatIfSimulation = { question ->
                                        whatIfViewModel.setWhatIfDraft(question)
                                        whatIfViewModel.runSimulation(question)
                                        navigateTo(WhatIfRoutes.WHAT_IF)
                                    },
                                    onOpenCreatorProfile = {
                                        navigateTo(WhatIfRoutes.CREATOR)
                                    }
                                )
                            }

                            composable(WhatIfRoutes.CONVERSATIONS) {
                                ConversationsScreen(
                                    conversations = conversations,
                                    simulations = simulations,
                                    onOpenConversation = { id ->
                                        chatViewModel.selectConversation(id)
                                        navigateTo(WhatIfRoutes.CHAT)
                                    },
                                    onDeleteConversation = { id ->
                                        chatViewModel.resetActiveSelectionIfDeleted(id)
                                        whatIfViewModel.deleteConversation(id)
                                    },
                                    onOpenSimulation = { sim ->
                                        whatIfViewModel.openSavedSimulation(sim)
                                        navigateTo(WhatIfRoutes.WHAT_IF)
                                    },
                                    onDeleteSimulation = whatIfViewModel::deleteSimulation,
                                    onOpenCreatorProfile = {
                                        navigateTo(WhatIfRoutes.CREATOR)
                                    }
                                )
                            }

                            composable(WhatIfRoutes.MORE) {
                                MoreScreen(
                                    onOpenCreatorProfile = {
                                        navigateTo(WhatIfRoutes.CREATOR)
                                    },
                                    onOpenChat = {
                                        chatViewModel.ensureActiveConversation(greeting)
                                        navigateTo(WhatIfRoutes.CHAT)
                                    },
                                    onOpenWhatIfMode = {
                                        navigateTo(WhatIfRoutes.WHAT_IF)
                                    },
                                    onOpenCore = {
                                        navigateTo(WhatIfRoutes.CORE)
                                    },
                                    onOpenExplore = {
                                        navigateTo(WhatIfRoutes.EXPLORE)
                                    },
                                    onOpenHistory = {
                                        navigateTo(WhatIfRoutes.CONVERSATIONS)
                                    },
                                    onClearAppCache = handleClearAppCache,
                                    onClearAllLocalData = handleClearAllLocalData
                                )
                            }

                            composable(WhatIfRoutes.CREATOR) {
                                CreatorProfileScreen(
                                    onAskAboutCreator = {
                                        chatViewModel.startNewChat(
                                            greeting = greeting,
                                            initialPrompt = "Tell me about INFFOLER AI and its founder Alankrit Pathak."
                                        )
                                        navigateTo(WhatIfRoutes.CHAT)
                                    },
                                    onOpenWhatIfMode = {
                                        navigateTo(WhatIfRoutes.WHAT_IF)
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
