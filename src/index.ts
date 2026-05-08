import { type PluginCommandContext, definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

const DEFAULT_COOLDOWN_MINUTES = 30;

interface DiscordIgnoreConfig {
    defaultCooldownMinutes?: number | undefined;
    ignoredAccountIds?: string[] | undefined;
    ignoredLeadingStrings?: string[] | undefined;
}

const cooldownUntilByChannelId = new Map<string, number>();

const getConfig = <K extends keyof DiscordIgnoreConfig>(
    config: Record<string, unknown> | undefined,
    key: K
): DiscordIgnoreConfig[K] => (config as DiscordIgnoreConfig | undefined)?.[key];

const cleanupExpiredCooldowns = (): void => {
    const now = Date.now();
    for (const [channelId, until] of cooldownUntilByChannelId) {
        if (now >= until) {
            cooldownUntilByChannelId.delete(channelId);
        }
    }
};

// The plugin SDK has `context.channelId`, but in the case of Discord, its value is always `"discord"`, so we infer the channel ID from the session key.
// eslint-disable-next-line no-magic-numbers
const getChannelIdFromSessionKey = (sessionKey: string): string | null => sessionKey.split(":").at(-1) ?? null;

// eslint-disable-next-line max-statements
const handleCooldownCommand = (context: PluginCommandContext, defaultCooldownMinutes: number): { text: string } => {
    cleanupExpiredCooldowns();

    const { sessionKey } = context;
    const channelId = sessionKey ? getChannelIdFromSessionKey(sessionKey) : null;

    if (!channelId) {
        return {
            text: "Could not determine the current channel."
        };
    }

    const arg = context.args?.trim().toLowerCase();
    if (arg === "off") {
        cooldownUntilByChannelId.delete(channelId);

        return {
            text: "Cooldown has been disabled for this channel."
        };
    }

    if (arg === "on" || !arg) {
        const minutes = defaultCooldownMinutes;
        // eslint-disable-next-line no-magic-numbers
        const until = Date.now() + minutes * 60 * 1000;
        cooldownUntilByChannelId.set(channelId, until);

        return {
            text: `Cooldown enabled for this channel for ${minutes.toString()} minutes.`
        };
    }

    const durationArg = Number(arg);
    // eslint-disable-next-line no-magic-numbers
    if (!isNaN(durationArg) && durationArg > 0) {
        // eslint-disable-next-line no-magic-numbers
        const until = Date.now() + durationArg * 60 * 1000;
        cooldownUntilByChannelId.set(channelId, until);

        return {
            text: `Cooldown enabled for this channel for ${durationArg.toString()} minutes.`
        };
    }

    return {
        text: "Usage: /cooldown, /cooldown <minutes>, /cooldown on, /cooldown off"
    };
};

export default definePluginEntry({
    description: "Rule-based Discord message filtering and /cooldown slash command support for OpenClaw.",
    id: "discord-ignore",
    name: "Discord Ignore",

    // eslint-disable-next-line max-lines-per-function
    register(api) {
        const ignoredAccountIds = new Set(getConfig(api.pluginConfig, "ignoredAccountIds"));
        const ignoredLeadingStrings = getConfig(api.pluginConfig, "ignoredLeadingStrings") ?? [];
        const defaultCooldownMinutes =
            getConfig(api.pluginConfig, "defaultCooldownMinutes") ?? DEFAULT_COOLDOWN_MINUTES;

        api.registerCommand({
            acceptsArgs: true,
            channels: ["discord"],
            description: "Enable or disable cooldown for this channel.",
            handler: (context) => handleCooldownCommand(context, defaultCooldownMinutes),
            name: "cooldown",
            requireAuth: true
        });

        api.on(
            "before_dispatch",
            /* eslint-disable consistent-return */
            // eslint-disable-next-line max-statements
            (event, context) => {
                if (event.channel !== "discord") return;

                cleanupExpiredCooldowns();

                const senderId = event.senderId ?? context.senderId;
                if (senderId && ignoredAccountIds.has(senderId)) return { handled: true };

                const { sessionKey } = context;
                const channelId = sessionKey ? getChannelIdFromSessionKey(sessionKey) : null;
                if (!channelId) return;

                // Don't drop slash commands
                const body = (event.body ?? event.content).trim();
                if (body.startsWith("/") && !body.startsWith("/ ")) return;

                // Strip Discord mentions (<@USER_ID>) before checking
                const withoutMentions = body.replace(/<@!?\d+>\s*/gu, "").trim();
                if (ignoredLeadingStrings.some((prefix) => withoutMentions.startsWith(prefix))) {
                    return { handled: true };
                }

                const until = cooldownUntilByChannelId.get(channelId);
                if (until) return { handled: true };

                // eslint-disable-next-line no-useless-return
                return;
            },
            /* eslint-enable consistent-return */
            { priority: 100 }
        );
    }
});
