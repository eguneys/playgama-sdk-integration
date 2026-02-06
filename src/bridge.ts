declare const bridge: Bridge


export async function bridge_init() {
    await bridge.initialize()
}


export function get_info() {
    return {
        id: bridge.platform.id,
        sdk: bridge.platform.sdk,
        language: bridge.platform.language,
        payload: bridge.platform.payload,
        tld: bridge.platform.tld
    }
}

export function send_game_ready(info: GameReadyInfo) {
    bridge.platform.sendMessage(info)
}


export enum GameReadyInfo {
    GameReady = 'game_ready',
    Gameplay_Started = 'gameplay_started',
    Gameplay_Stopped = 'gameplay_stopped',
    PlayerGotAchievement = 'player_got_achievement'
}


export function is_audio_enabled() {
    return bridge.platform.isAudioEnabled
}


export function set_audio_enabled_change_cb(cb: (is_audio_enabled: boolean) => void) {
    bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, cb)
}
export function set_is_paused_change_cb(cb: (is_paused: boolean) => void) {
    bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, cb)
}


export function set_is_visible_change_cb(cb: (visibility: Visibility) => void) {
    bridge.game.on(bridge.EVENT_NAME.VISIBILITY_STATE_CHANGED, cb)
}

export type Visibility = 'hidden' | 'visible'
 
export async function get_server_time() {
    let res = await bridge.platform.getServerTime()
    return res
}


export function show_banner_if_supported() {
    if (bridge.advertisement.isBannerSupported) {
        bridge.advertisement.showBanner('bottom')
    }
}

export function hide_banner() {
    bridge.advertisement.hideBanner()
}


export function get_device_type(): DeviceType {
    return bridge.device.type
}


export type DeviceType = 'mobile' | 'tablet' | 'decktop' | 'tv'


export function get_player_info(): BridgePlayerInfo {
    return {
        id: bridge.player.id,
        name: bridge.player.name
    }
}

export type BridgePlayerInfo = {
    id: string
    name: string
}


export type LeaderboardsType =
    | 'not_available'
    | 'in_game'
    | 'native'
    | 'native_popup'

export type LeaderboardId = string

export async function show_leaderboard_native_popup(id: LeaderboardId) {
    await bridge.leaderboards.showNativePopup(id)
}

export async function get_leaderboard_entries(id: LeaderboardId): Promise<LeaderboardEntry[]> {
    let res = await bridge.leaderboards.getEntries(id)
    return res
}

export type LeaderboardEntry = {
    id: string
    name: string
    photo: string
    score: string
    rank: string
}


export function set_leaderboard_score(id: LeaderboardId, score: number) {
    bridge.leaderboards.setScore(id, score)
}

export const test_leaderboard_id = 'test_leaderboard'