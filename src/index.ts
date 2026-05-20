import { type PluginCommandContext, definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

const DEFAULT_COOLDOWN_MINUTES = 30;
const DEFAULT_AUTO_COOLDOWN_REQUEST_COUNT = 10;
const DEFAULT_AUTO_COOLDOWN_WITHIN_MINUTES = 10;
const DEFAULT_AUTO_COOLDOWN_COOLDOWN_MINUTES = 10;

interface AutoCooldownConfig {
    cooldownMinutes?: number | undefined;
    requestCount?: number | undefined;
    withinMinutes?: number | undefined;
}

type ResolvedAutoCooldownConfig = Required<{
    [K in keyof AutoCooldownConfig]: NonNullable<AutoCooldownConfig[K]>;
}>;

interface DiscordIgnoreConfig {
    autoCooldown?: boolean | AutoCooldownConfig | undefined;
    cooldownBypassAccountIds?: string[] | undefined;
    defaultCooldownMinutes?: number | undefined;
    ignoredAccountIds?: string[] | undefined;
    ignoredLeadingStrings?: string[] | undefined;
}

const cooldownUntilByChannelId = new Map<string, number>();
const requestTimestampsByChannelId = new Map<string, number[]>();

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

const getPositiveNumberOrDefault = (value: number | undefined, defaultValue: number): number =>
    // eslint-disable-next-line no-magic-numbers
    typeof value === "number" && value > 0 ? value : defaultValue;

const resolveAutoCooldownConfig = (
    config: boolean | AutoCooldownConfig | undefined
): ResolvedAutoCooldownConfig | null => {
    if (!config) return null;

    const configObject = typeof config === "object" ? config : {};

    return {
        cooldownMinutes: getPositiveNumberOrDefault(
            configObject.cooldownMinutes,
            DEFAULT_AUTO_COOLDOWN_COOLDOWN_MINUTES
        ),
        requestCount: getPositiveNumberOrDefault(configObject.requestCount, DEFAULT_AUTO_COOLDOWN_REQUEST_COUNT),
        withinMinutes: getPositiveNumberOrDefault(configObject.withinMinutes, DEFAULT_AUTO_COOLDOWN_WITHIN_MINUTES)
    };
};

const cleanupAutoCooldownRequestTimestamps = (channelId: string, config: ResolvedAutoCooldownConfig): number[] => {
    const timestamps = requestTimestampsByChannelId.get(channelId);
    if (!timestamps) return [];

    const now = Date.now();

    // eslint-disable-next-line no-magic-numbers
    const withinMilliseconds = config.withinMinutes * 60 * 1000;
    const recentTimestamps = timestamps.filter((timestamp) => now - timestamp < withinMilliseconds);

    if (!recentTimestamps.length) {
        requestTimestampsByChannelId.delete(channelId);
        return [];
    }

    requestTimestampsByChannelId.set(channelId, recentTimestamps);
    return recentTimestamps;
};

const trackAutoCooldownRequest = (channelId: string, config: ResolvedAutoCooldownConfig): void => {
    const now = Date.now();
    const recentTimestamps = cleanupAutoCooldownRequestTimestamps(channelId, config);

    recentTimestamps.push(now);

    if (recentTimestamps.length >= config.requestCount) {
        // eslint-disable-next-line no-magic-numbers
        cooldownUntilByChannelId.set(channelId, now + config.cooldownMinutes * 60 * 1000);
        requestTimestampsByChannelId.delete(channelId);
        return;
    }

    requestTimestampsByChannelId.set(channelId, recentTimestamps);
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
        const cooldownBypassAccountIds = new Set(getConfig(api.pluginConfig, "cooldownBypassAccountIds"));
        const ignoredAccountIds = new Set(getConfig(api.pluginConfig, "ignoredAccountIds"));
        const ignoredLeadingStrings = getConfig(api.pluginConfig, "ignoredLeadingStrings") ?? [];
        const autoCooldownConfig = resolveAutoCooldownConfig(getConfig(api.pluginConfig, "autoCooldown"));
        const defaultCooldownMinutes =
            getConfig(api.pluginConfig, "defaultCooldownMinutes") ?? DEFAULT_COOLDOWN_MINUTES;

        api.registerCommand({
            acceptsArgs: true,
            channels: ["discord"],
            description: "Enable or disable cooldown for this channel. Optional arg: on, off, or minutes.",
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

                if (autoCooldownConfig) {
                    cleanupAutoCooldownRequestTimestamps(channelId, autoCooldownConfig);
                }

                // Don't drop slash commands
                const body = (event.body ?? event.content).trim();
                if (body.startsWith("/") && !body.startsWith("/ ")) return;

                // Strip Discord mentions (<@USER_ID>) before checking
                const withoutMentions = body.replace(/<@!?\d+>\s*/gu, "").trim();
                if (ignoredLeadingStrings.some((prefix) => withoutMentions.startsWith(prefix))) {
                    return { handled: true };
                }

                const until = cooldownUntilByChannelId.get(channelId);
                const shouldBypassCooldown = senderId ? cooldownBypassAccountIds.has(senderId) : false;
                if (until && !shouldBypassCooldown) return { handled: true };

                if (autoCooldownConfig) {
                    trackAutoCooldownRequest(channelId, autoCooldownConfig);
                }

                // eslint-disable-next-line no-useless-return
                return;
            },
            /* eslint-enable consistent-return */
            { priority: 100 }
        );
    }
});
