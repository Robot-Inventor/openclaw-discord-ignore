# openclaw-discord-ignore

Rule-based Discord message filtering plugin for OpenClaw.

This plugin can drop selected inbound Discord messages before they are dispatched to the agent. It also adds a `/cooldown` command that temporarily ignores messages in the current Discord channel.

## Features

- Ignore messages from configured Discord account IDs.
- Ignore messages that start with configured leading strings.
- Temporarily put the current channel on cooldown with `/cooldown`.

By default, no account IDs and no leading strings are ignored.

## Configuration

Configure the plugin through OpenClaw's plugin config for `discord-ignore`.

```json
{
    "defaultCooldownMinutes": 30,
    "ignoredAccountIds": [],
    "ignoredLeadingStrings": []
}
```

For example, to ignore messages that start with colon, you can set `ignoredLeadingStrings` like this:

```json
{
    "ignoredLeadingStrings": [":", "："]
}
```

- `defaultCooldownMinutes`: Default cooldown duration in minutes used by the `/cooldown` command. The default value is `30`.
- `ignoredAccountIds`: An array of Discord account IDs (as strings) whose messages should be ignored.
- `ignoredLeadingStrings`: An array of strings. Inbound messages that start with any of these strings will be ignored.

## Commands

This plugin also adds `/cooldown` slash command to Discord, which can be used to temporarily ignore messages in the current channel for a specified duration.

You can enable cooldown in the current channel with `/cooldown` or `/cooldown on`, which will use the `defaultCooldownMinutes` value as the cooldown duration. You can also specify a custom cooldown duration in minutes with `/cooldown <minutes>`. To disable cooldown, use `/cooldown off`.
