import { GENERATOR_LABELS } from '../animation/defaults'
import { isKeyframeLayer, type Layer } from '../animation/types'

export const layerLabel = (layer: Layer) => (isKeyframeLayer(layer) ? 'Keyframes' : GENERATOR_LABELS[layer.generator])
