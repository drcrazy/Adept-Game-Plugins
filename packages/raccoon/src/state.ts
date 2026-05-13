/** Ephemeral state stored under `activeCard.pluginState.raccoon`. */
export type RaccoonPluginState = {
  splashDismissed?: boolean;
  seatPassUsed?: boolean;
  passHoverSeat?: number | null;
};
