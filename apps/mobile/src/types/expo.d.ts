/* Expo's type augmentations in every checkout: the web props of React
   Native components, among them the `className` the icon package's
   sources pass to the SVG. Expo CLI writes the same reference into
   expo-env.d.ts when it runs, but that file is generated and ignored, so
   a fresh clone would type-check without it. */
/// <reference types="expo/types" />
