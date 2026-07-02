// SPDX-License-Identifier: AGPL-3.0-or-later

import { AudioRecorder } from "./audio";

/** Singleton AudioRecorder shared across the app. */
export const recorder = new AudioRecorder();
