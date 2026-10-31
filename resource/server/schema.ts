import type { PanelSchema } from "@aicore-fivem/shared";
import { DEFAULT_SETTINGS } from "common/race";

/** ai-streetraces' panel: one settings file (buy-in limits, join time, racers, police alerts). */
export const streetracesSchema: PanelSchema = {
  title: "ADMIN_TITLE",
  icon: "flag-checkered",
  files: {
    settings: {
      kind: "settings",
      // Clients read the buy-in limits and the minimum distance for the create dialog.
      sync: "all",
      sections: {
        account: { type: "text", lookup: "account", min: 2, max: 32 },
        minBuyIn: { type: "number", min: 0, max: 10_000_000, integer: true },
        maxBuyIn: { type: "number", min: 0, max: 10_000_000, integer: true },
        joinSeconds: { type: "number", min: 15, max: 300, integer: true },
        maxRacers: { type: "number", min: 2, max: 16, integer: true },
        inviteRadius: { type: "number", min: 10, max: 400, integer: true },
        minDistance: { type: "number", min: 100, max: 10_000, integer: true },
        maxMinutes: { type: "number", min: 1, max: 60, integer: true },
        alertChance: { type: "number", min: 0, max: 100, integer: true },
      },
      defaults: { ...DEFAULT_SETTINGS },
    },
  },
  tabs: [
    {
      id: "settings",
      file: "settings",
      icon: "sliders",
      label: "ADMIN_TAB_SETTINGS",
      desc: "ADMIN_TAB_SETTINGS_DESC",
      cards: [
        {
          icon: "money-bill-wave",
          title: "ADMIN_C_MONEY",
          desc: "ADMIN_C_MONEY_DESC",
          fields: [
            {
              widget: "text",
              lookup: "account",
              path: "account",
              label: "ADMIN_F_ACCOUNT",
              hint: "ADMIN_H_ACCOUNT",
              placeholder: "ADMIN_P_ACCOUNT",
            },
            {
              widget: "number",
              path: "minBuyIn",
              label: "ADMIN_F_MIN_BUYIN",
              hint: "ADMIN_H_MIN_BUYIN",
              min: 0,
              max: 10_000_000,
              unit: "$",
            },
            {
              widget: "number",
              path: "maxBuyIn",
              label: "ADMIN_F_MAX_BUYIN",
              hint: "ADMIN_H_MAX_BUYIN",
              min: 0,
              max: 10_000_000,
              unit: "$",
            },
          ],
        },
        {
          icon: "flag-checkered",
          title: "ADMIN_C_RACES",
          desc: "ADMIN_C_RACES_DESC",
          fields: [
            {
              widget: "number",
              path: "joinSeconds",
              label: "ADMIN_F_JOIN_TIME",
              hint: "ADMIN_H_JOIN_TIME",
              min: 15,
              max: 300,
              unit: "s",
            },
            {
              widget: "number",
              path: "maxRacers",
              label: "ADMIN_F_MAX_RACERS",
              hint: "ADMIN_H_MAX_RACERS",
              min: 2,
              max: 16,
            },
            {
              widget: "number",
              path: "inviteRadius",
              label: "ADMIN_F_INVITE_RADIUS",
              hint: "ADMIN_H_INVITE_RADIUS",
              min: 10,
              max: 400,
              unit: "m",
            },
            {
              widget: "number",
              path: "minDistance",
              label: "ADMIN_F_MIN_DISTANCE",
              hint: "ADMIN_H_MIN_DISTANCE",
              min: 100,
              max: 10_000,
              unit: "m",
            },
            {
              widget: "number",
              path: "maxMinutes",
              label: "ADMIN_F_MAX_TIME",
              hint: "ADMIN_H_MAX_TIME",
              min: 1,
              max: 60,
              unit: "min",
            },
          ],
        },
        {
          icon: "triangle-exclamation",
          title: "ADMIN_C_POLICE",
          desc: "ADMIN_C_POLICE_DESC",
          fields: [
            {
              widget: "number",
              path: "alertChance",
              label: "ADMIN_F_ALERT_CHANCE",
              hint: "ADMIN_H_ALERT_CHANCE",
              min: 0,
              max: 100,
              unit: "%",
            },
          ],
        },
      ],
    },
  ],
};
