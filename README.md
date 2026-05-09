# openclaw-discord-ignore

Rule-based Discord message filtering plugin for OpenClaw.

This plugin can drop selected inbound Discord messages before they are dispatched to the agent. It also adds a `/cooldown` command that temporarily ignores messages in the current Discord channel.

## Features

- Ignore messages from configured Discord account IDs.
- Ignore messages that start with configured leading strings.
- Temporarily put the current channel on cooldown with `/cooldown`.
- Automatically put a channel on cooldown when too many requests arrive in a configured time window.

By default, no account IDs and no leading strings are ignored.

## Configuration

Configure the plugin through OpenClaw's plugin config for `discord-ignore`.

```json
{
    "autoCooldown": false,
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

### `defaultCooldownMinutes`

Default cooldown duration in minutes used by the `/cooldown` command. The default value is `30`.

- Type: `number`
- Default: `30`

### `ignoredAccountIds`

An array of Discord account IDs (as strings) whose messages should be ignored.

- Type: `string[]`
- Default: `[]`

### `ignoredLeadingStrings`

An array of strings. Inbound messages that start with any of these strings will be ignored.

- Type: `string[]`
- Default: `[]`

### `autoCooldown`

Automatic cooldown configuration. Set this to `false` or omit it to disable automatic cooldown, set it to `true` to use defaults, or provide an object to override specific values.

- `autoCooldown.requestCount`: Number of requests required to trigger automatic cooldown. The default value is `10`.
- `autoCooldown.withinMinutes`: Time window in minutes for counting requests. The default value is `10`.
- `autoCooldown.cooldownMinutes`: Cooldown duration in minutes after the request threshold is reached. The default value is `10`.

The default automatic cooldown behavior is 10 requests within 10 minutes triggers a 10 minute cooldown. If you want to use the default behavior, simply set `autoCooldown` to `true`:

```json
{
    "autoCooldown": true
}
```

You can override any automatic cooldown value. Omitted properties use the default values.

```json
{
    "autoCooldown": {
        "requestCount": 10,
        "withinMinutes": 10,
        "cooldownMinutes": 10
    }
}
```

- Type: `boolean | { requestCount?: number; withinMinutes?: number; cooldownMinutes?: number }`
- Default: `false`

## Commands

This plugin also adds `/cooldown` slash command to Discord, which can be used to temporarily ignore messages in the current channel for a specified duration.

You can enable cooldown in the current channel with `/cooldown` or `/cooldown on`, which will use the `defaultCooldownMinutes` value as the cooldown duration. You can also specify a custom cooldown duration in minutes with `/cooldown <minutes>`. To disable cooldown, use `/cooldown off`.
