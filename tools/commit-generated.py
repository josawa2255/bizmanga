#!/usr/bin/env python3
"""Commit only declared generated paths, and retry a normal push after rebasing.

For GitHub Actions only; concurrent generator workflows share one concurrency
group. A conflicting human edit fails the job for review rather than overwriting it.

After a successful push, the step outputs pushed=true, before (the remote tip the
commit was rebased onto) and after (the pushed commit), so the workflow can send
exactly the generated changes to IndexNow. A push with GITHUB_TOKEN does not
start other workflows, so indexnow.yml never sees these commits. Nothing is
output when there was nothing to push.
"""
import argparse
import os
import subprocess


def git(*args, check=True):
    return subprocess.run(["git", *args], check=check)


def commit_id(ref):
    return subprocess.run(
        ["git", "rev-parse", "--verify", ref + "^{commit}"], check=True, capture_output=True, text=True
    ).stdout.strip()


def write_outputs(**values):
    path = os.environ.get("GITHUB_OUTPUT")
    if not path:
        return
    with open(path, "a", encoding="utf-8") as output:
        for key, value in values.items():
            output.write(f"{key}={value}\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--message", required=True)
    parser.add_argument("paths", nargs="+")
    args = parser.parse_args()
    if os.environ.get("GITHUB_ACTIONS") != "true":
        parser.error("This publishing command is restricted to GitHub Actions")
    branch = os.environ["GITHUB_REF_NAME"]
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
        before, after = commit_id("FETCH_HEAD"), commit_id("HEAD")
        if before == after:
            # The rebase dropped the commit: the branch already has the same output.
            print("Generated changes are already on the branch.")
            return
        if git("push", "origin", f"HEAD:refs/heads/{branch}", check=False).returncode == 0:
            write_outputs(pushed="true", before=before, after=after)
            return
    raise RuntimeError("Push failed after three attempts")


if __name__ == "__main__":
    main()
