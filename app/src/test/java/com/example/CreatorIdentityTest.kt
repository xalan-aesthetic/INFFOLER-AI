package com.example

import com.example.data.CreatorIdentity
import org.junit.Assert.assertEquals
import org.junit.Test

class CreatorIdentityTest {

    @Test
    fun `contains official INFFOLER AI creator identity and all six Instagram accounts`() {
        assertEquals("INFFOLER AI", CreatorIdentity.APP_NAME)
        assertEquals("Alankrit Pathak", CreatorIdentity.CREATOR_NAME)
        assertEquals("https://github.com/xalan-aesthetic/INFFOLER-AI", CreatorIdentity.DEFAULT_GITHUB_REPO_URL)
        assertEquals("https://xalan-aesthetic.github.io/INFFOLER-AI/", CreatorIdentity.LIVE_WEBSITE_URL)

        val expected = listOf(
            "@xalan_vetrnen" to "https://www.instagram.com/xalan_vetrnen?cplk=b2c4NXRjcTkxbWR3",
            "@nrtzal" to "https://www.instagram.com/nrtzal?dlrf=MWd4dWVnc3BlbzNidQ==",
            "@alankrit_007__" to "https://www.instagram.com/alankrit_007__?exln=MXZ5c3NqNG5ycG9mMw==",
            "@xalanvex" to "https://www.instagram.com/xalanvex?mdxt=MXNqaXhhMzJqNGc5eQ==",
            "@alan.e3x.yn" to "https://www.instagram.com/alan.e3x.yn?mdxt=MWpla2VqcjV5MjZreg==",
            "@zenix_4rc_" to "https://www.instagram.com/zenix_4rc_?vrfl=dmJtcnNqdGhmam0z"
        )

        val actual = CreatorIdentity.instagramAccounts.map { it.username to it.url }
        assertEquals(6, actual.size)
        assertEquals(expected, actual)
    }

    @Test
    fun `normalizes valid GitHub repository URLs and rejects invalid ones`() {
        assertEquals(
            "https://github.com/alankrit/inffoler-ai",
            CreatorIdentity.normalizeGitHubRepoUrl("https://github.com/alankrit/inffoler-ai/")
        )
        assertEquals(
            "https://github.com/alankrit/inffoler-ai",
            CreatorIdentity.normalizeGitHubRepoUrl("github.com/alankrit/inffoler-ai")
        )
        assertEquals(
            "https://github.com/alankrit/inffoler-ai",
            CreatorIdentity.normalizeGitHubRepoUrl("alankrit/inffoler-ai")
        )
        assertEquals(null, CreatorIdentity.normalizeGitHubRepoUrl(""))
        assertEquals(null, CreatorIdentity.normalizeGitHubRepoUrl("not a valid url"))
        assertEquals(null, CreatorIdentity.normalizeGitHubRepoUrl("https://example.com/foo/bar"))
    }
}
