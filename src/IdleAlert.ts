import {Plugin, SettingsTypes} from "@highlite/plugin-api";
import { NotificationManager, SoundManager, ActionState } from "@highlite/plugin-api";
import IdleOverlay from "./IdleOverlay";
import idleSound from "../resources/sounds/idle_alert.mp3";

class IdleAlert extends Plugin {
    private notificationManager: NotificationManager =
        new NotificationManager();
    private soundManager: SoundManager = new SoundManager();
    pluginName: string = 'Idle Alert';
    author = 'Highlite';

    constructor() {
        super();
        this.settings.volume = {
            text: 'Volume',
            type: SettingsTypes.range,
            value: 50,
            callback: () => {}, //TODO
        };
        this.settings.activationTicks = {
            text: 'Activation Ticks',
            type: SettingsTypes.range,
            value: 20,
            callback: () => {}, //TODO
        };
        this.settings.notification = {
            text: 'Notification',
            type: SettingsTypes.checkbox,
            value: false,
            callback: () => {}, //TODO
        };

        this.settings.idleOverlay = {
            text: 'Overlay',
            type: SettingsTypes.checkbox,
            value: false,
            callback: () => {}, //TODO
        };
    }

    start(): void {
        this.log("Started");
    }
    stop(): void {
        this.log("Stopped");
    }

    ignoredStates: ActionState[] = [
        ActionState.BankingState,
        ActionState.ClimbSameMapLevelState,
        ActionState.GoThroughDoorState,
        ActionState.PlayerLoggingOutState,
        ActionState.PlayerDeadState,
        ActionState.StunnedState,
        ActionState.TradingState,
    ];
    actionState: number = ActionState.IdleState;
    idleTicks: number = 0;
    shouldTick: boolean = false;
    publicMessages: HTMLElement | null = null;
    chatObserver: MutationObserver | null = null;
    alertMessages: string[] = [
        'WARNING - You will be logged out in 1 minute due to inactivity'
    ];

    idleOverlay: IdleOverlay = new IdleOverlay();

    init(): void {
        this.log('Initialized');
        this.setupChatObserver();
    }

    private setupChatObserver(): void {
        this.publicMessages = document.querySelector("#hs-public-message-list")

        if(!this.publicMessages) {
            return
        }

        const config: MutationObserverInit = {
            childList: true,
            subtree: true,
        };

        const callback: MutationCallback = (mutationsList: MutationRecord[], observer: MutationObserver) => {
            for(const mutation of mutationsList) {
                if(mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    for(const node of mutation.addedNodes) {
                        if(node instanceof HTMLElement && node.tagName === "LI") {
                            const messageContainer = node.querySelector(".hs-chat-menu__message-text-container");
                            if(messageContainer) {
                                const messageText = messageContainer.textContent?.trim();
                                if(messageText !== undefined) {
                                    if(this.alertMessages.includes(messageText)) {
                                        this.createAlert(messageText);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };

        this.chatObserver = new MutationObserver(callback);
        this.chatObserver.observe(this.publicMessages, config);
    }

    GameLoop_update(...args: any) {
        if (!this.settings.enable.value) {
            return;
        }
        const player = this.gameHooks.EntityManager.Instance._mainPlayer;

        if (player === undefined) {
            return;
        }

        if (
            this.ignoredStates.includes(player._currentState.getCurrentState())
        ) {
            return;
        }

        // If player moves we stop tracking ticks since they are no longer during an "AFK" action.
        if (
            player._isMoving &&
            player._currentTarget == null &&
            player._currentState.getCurrentState() == ActionState.IdleState
        ) {
            this.shouldTick = false;
            this.actionState = ActionState.IdleState;
            return;
        } else {
            this.shouldTick = true;
        }

        // Updates system so we know we have been doing actions
        if (player._currentState.getCurrentState() !== ActionState.IdleState) {
            this.actionState = player._currentState.getCurrentState();
        }

        if (
            player._currentState.getCurrentState() == ActionState.IdleState &&
            this.actionState !== ActionState.IdleState &&
            player._currentTarget == null &&
            this.shouldTick
        ) {
            this.idleTicks++;
            this.log(this.idleTicks);
        } else {
            this.idleTicks = 0;
        }

        if (this.idleTicks > (this.settings.activationTicks!.value as number)) {

            this.createAlert('is Idle!')

            this.actionState = 0;
            this.idleTicks = 0;
        }
    }

    private createAlert(message: string) {
        const player = this.gameHooks.EntityManager.Instance._mainPlayer;

        if (player === undefined) {
            return;
        }

        if (this.settings.notification!.value) {
            this.notificationManager.createNotification(
                `${player._name} - ${message}`
            );
        }

        if (this.settings.idleOverlay!.value) {
            this.idleOverlay.show();
        }

        this.soundManager.playSound(
            idleSound,
            (this.settings.volume!.value as number) / 100
        );
    }
}

export default IdleAlert;
export { IdleAlert };
