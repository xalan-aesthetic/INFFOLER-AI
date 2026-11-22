package com.example.data

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import android.widget.Toast
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

private const val TAG = "CreatorSocials"
private const val PREFS_NAME = "inffoler_creator_prefs"
private const val KEY_GITHUB_REPO_URL = "github_repo_url"

data class InstagramAccount(
    val username: String,
    val url: String
)

object CreatorIdentity {
    const val APP_NAME = "INFFOLER AI"
    const val CREATOR_NAME = "Alankrit Pathak"
    const val CREATOR_ROLE = "Founder & Creator of INFFOLER AI"
    const val CREATOR_QUOTE = "\"Building ideas into intelligent experiences.\""
    const val GITHUB_HOME_URL = "https://github.com"

    val instagramAccounts: List<InstagramAccount> = listOf(
        InstagramAccount(
            username = "@xalan_vetrnen",
            url = "https://www.instagram.com/xalan_vetrnen?cplk=b2c4NXRjcTkxbWR3"
        ),
        InstagramAccount(
            username = "@nrtzal",
            url = "https://www.instagram.com/nrtzal?dlrf=MWd4dWVnc3BlbzNidQ=="
        ),
        InstagramAccount(
            username = "@alankrit_007__",
            url = "https://www.instagram.com/alankrit_007__?exln=MXZ5c3NqNG5ycG9mMw=="
        ),
        InstagramAccount(
            username = "@xalanvex",
            url = "https://www.instagram.com/xalanvex?mdxt=MXNqaXhhMzJqNGc5eQ=="
        ),
        InstagramAccount(
            username = "@alan.e3x.yn",
            url = "https://www.instagram.com/alan.e3x.yn?mdxt=MWpla2VqcjV5MjZreg=="
        ),
        InstagramAccount(
            username = "@zenix_4rc_",
            url = "https://www.instagram.com/zenix_4rc_?vrfl=dmJtcnNqdGhmam0z"
        )
    )

    fun normalizeGitHubRepoUrl(rawInput: String): String? {
        val trimmed = rawInput.trim().trimEnd('/')
        if (trimmed.isEmpty() || trimmed.contains(" ")) return null

        val withScheme = when {
            trimmed.startsWith("https://", ignoreCase = true) -> trimmed
            trimmed.startsWith("http://", ignoreCase = true) -> "https://${trimmed.substringAfter("://")}"
            trimmed.startsWith("github.com/", ignoreCase = true) -> "https://$trimmed"
            trimmed.startsWith("www.github.com/", ignoreCase = true) -> "https://${trimmed.removePrefix("www.")}"
            trimmed.matches(Regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")) -> "https://github.com/$trimmed"
            else -> return null
        }

        val normalized = withScheme.replace("https://www.github.com/", "https://github.com/", ignoreCase = true)
        val pathPart = normalized.removePrefix("https://github.com/")
        return if (normalized.startsWith("https://github.com/") && pathPart.isNotBlank() && !pathPart.contains("..")) {
            normalized
        } else {
            null
        }
    }

    fun openProfile(context: Context, url: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Unable to open URL: $url", e)
            Toast.makeText(context, "Unable to open link on this device", Toast.LENGTH_SHORT).show()
        }
    }
}

object GitHubRepoPreferences {
    private val _repoUrl = MutableStateFlow<String?>(null)
    val repoUrl: StateFlow<String?> = _repoUrl.asStateFlow()

    @Volatile
    private var loaded = false

    fun ensureLoaded(context: Context): String? {
        if (!loaded) {
            val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            _repoUrl.value = prefs.getString(KEY_GITHUB_REPO_URL, null)
            loaded = true
        }
        return _repoUrl.value
    }

    fun saveRepoUrl(context: Context, rawUrl: String): String? {
        val normalized = CreatorIdentity.normalizeGitHubRepoUrl(rawUrl) ?: return null
        val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_GITHUB_REPO_URL, normalized).apply()
        _repoUrl.value = normalized
        loaded = true
        return normalized
    }

    fun clearRepoUrl(context: Context) {
        val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().remove(KEY_GITHUB_REPO_URL).apply()
        _repoUrl.value = null
        loaded = true
    }
}
