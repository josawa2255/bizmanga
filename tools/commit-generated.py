#!/usr/bin/env python3
"""Commit only declared generated paths, push them (rebasing onto other pushes), and start the deploy.

For GitHub Actions only; concurrent generator workflows share one concurrency
group. A conflicting human edit fails the job for review rather than overwriting it.

A push with GITHUB_TOKEN does not start other workflows (GitHub's rule), so the
push trigger of pages.yml never sees these commits. Right after a successful push
to main, this starts the deploy itself: `gh workflow run pages.yml --ref main`
(a workflow_dispatch made with GITHUB_TOKEN does start workflows). The workflow
step needs GH_TOKEN and `permissions: actions: write`. pages.yml deploys the tip
of main and then sends the changes since the last deployment to IndexNow.
Nothing is started when nothing was pushed, or when the branch is not main.
If the deploy cannot be started, the job fails (the push has already happened).
"""
import argparse
import os
import subprocess

DEPLOY_WORKFLOW = "pages.yml"
DEPLOY_BRANCH = "main"


def git(*args, check=True):
    return subprocess.run(["git", *args], check=check)


def commit_id(ref):
    return subprocess.run(
        ["git", "rev-parse", "--verify", ref + "^{commit}"], check=True, capture_output=True, text=True
    ).stdout.strip()


def start_deploy(repository, branch):
    """Start pages.yml for main after a push. Other branches are never deployed."""
    if branch != DEPLOY_BRANCH:
        print(f"Not starting {DEPLOY_WORKFLOW}: it deploys {DEPLOY_BRANCH}, not {branch}.", flush=True)
        return
    command = ["gh", "workflow", "run", DEPLOY_WORKFLOW, "--ref", DEPLOY_BRANCH, "--repo", repository]
    try:
        started = subprocess.run(command, check=False).returncode == 0
    except OSError as error:
        print(error, flush=True)
        started = False
    if not started:
        raise SystemExit(
            f"::error::The generated files were pushed to {branch}, but {DEPLOY_WORKFLOW} could not be started, "
            "so they are not deployed yet. Run 'Deploy to GitHub Pages' by hand (Actions > Run workflow).")
    print(f"Started {DEPLOY_WORKFLOW} on {DEPLOY_BRANCH}.", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--message", required=True)
    parser.add_argument("paths", nargs="+")
    args = parser.parse_args()
    if os.environ.get("GITHUB_ACTIONS") != "true":
        parser.error("This publishing command is restricted to GitHub Actions")
    branch = os.environ["GITHUB_REF_NAME"]
    repository = os.environ["GITHUB_REPOSITORY"]
    git("check-ref-format", "--branch", branch)
    git("config", "user.name", "github-actions[bot]")
    git("config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com")
    git("add", "--", *args.paths)
    diff = git("diff", "--cached", "--quiet", check=False)
    if diff.returncode == 0:
        print("No generated changes to commit.")
        return
    if diff.returncode != 1:
        raise RuntimeError("Could not inspect staged changes")
    git("commit", "-m", args.message)
    for _ in range(3):
        git("fetch", "origin", branch)
        git("rebase", "FETCH_HEAD")
        if commit_id("FETCH_HEAD") == commit_id("HEAD"):
            # The rebase dropped the commit: the branch already has the same output.
            print("Generated changes are already on the branch.")
            return
        if git("push", "origin", f"HEAD:refs/heads/{branch}", check=False).returncode == 0:
            print(f"Pushed {commit_id('HEAD')} to {branch}.", flush=True)
            start_deploy(repository, branch)
            return
    raise RuntimeError("Push failed after three attempts")


if __name__ == "__main__":
    main()
