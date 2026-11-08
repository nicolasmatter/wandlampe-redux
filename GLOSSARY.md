# Wandlampe

A wall lamp with an LED strip, controlled by a physical switch and configured from a web controller over MQTT.

## Language

**Mode**:
One entry in the lamp's configuration that the physical switch can select, such as a single color, a gradient, or an animation.
_Avoid_: Preset, scene, program

**Animation**:
A description of how the LEDs change over time, built from layers rather than written as code. A mode embeds its animation as a full copy; brightness belongs to the mode, not the animation.
_Avoid_: Effect, pattern, sequence

**Lab**:
The test page where animations are created and previewed, separate from the controller that configures the lamp.
_Avoid_: Playground, sandbox, editor

**Generator**:
A named, parameterised building block of an animation, such as bands or a chase, defined entirely by its parameter values.
_Avoid_: Effect, plugin, preset

**Loop**:
The fixed duration over which an animation repeats seamlessly; each layer runs at a whole-number multiple or fraction of it.
_Avoid_: Cycle, period, duration

**Layer**:
One generator or keyframe sequence within an animation's stack, combined with the layers beneath it by a blend mode and opacity.
_Avoid_: Track, channel

**Seed**:
The number that fixes a random layer's output, so it repeats identically every loop on both the preview and the lamp.

**Free-running**:
A random layer that ignores its seed and the loop, so it never repeats and the preview only approximates the lamp.
_Avoid_: Live, unseeded

**Keyframe**:
A set of color stops at a point in the loop; colors and stop positions between keyframes are interpolated.
_Avoid_: Frame, snapshot

**Ring**:
The lamp's LED strip, closed into a circle mounted flat on the wall. Position 0 is the bottom and positions increase counterclockwise as you face the lamp; 0.5 is the top, and 1 is the bottom again.
_Avoid_: Strip (when meaning the shape), circle, loop

**Mirror**:
A layer drawn once along a half-ring from bottom (0) to top (1) and shown identically on both sides of the ring.
_Avoid_: Symmetry, reflect, flip

**Color stop**:
A color at a relative position on the ring, from 0 to 1, independent of the LED count. Stops wrap around, so the last one blends back into the first.
_Avoid_: Pixel, LED value
