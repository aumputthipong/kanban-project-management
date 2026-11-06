import { afterEach, vi } from "vitest";
import { act } from "@testing-library/react";
import type * as ZustandExportedTypes from "zustand";
export * from "zustand";

const { create: actualCreate } = await vi.importActual<typeof ZustandExportedTypes>("zustand");

export const storeResetFns = new Set<() => void>();

const createUncurried = <T>(stateCreator: ZustandExportedTypes.StateCreator<T>) => {
  const store = actualCreate(stateCreator);
  const initialState = store.getInitialState();
  storeResetFns.add(() => store.setState(initialState, true));
  return store;
};

// Mirrors zustand's curried `create<T>()(...)` overload.
export const create = (<T>(stateCreator: ZustandExportedTypes.StateCreator<T>) =>
  typeof stateCreator === "function"
    ? createUncurried(stateCreator)
    : createUncurried) as typeof ZustandExportedTypes.create;

afterEach(() => {
  act(() => {
    storeResetFns.forEach((resetFn) => resetFn());
  });
});
