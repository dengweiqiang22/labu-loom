import type { MotionInfo } from 'easy-live2d'

import { convertFileSrc } from '@tauri-apps/api/core'
import { readDir, readTextFile } from '@tauri-apps/plugin-fs'
import { Config, CubismSetting, Live2DSprite, Priority } from 'easy-live2d'
import { groupBy } from 'es-toolkit/compat'
import JSON5 from 'json5'
import { Application, Ticker } from 'pixi.js'

import type { ModelSize } from '@/composables/useModel'

import { i18n } from '@/locales'

import { join } from './path'

Config.MouseFollow = false

interface StartMotionOptions {
  priority?: Priority
  onFinished?: () => void
}

class Live2d {
  // The renderer is recreated whenever Vue replaces its canvas during development.
  private app: Application | null = null
  public model: Live2DSprite | null = null

  constructor() { }

  private async initApp() {
    const view = document.getElementById('live2dCanvas')

    if (!(view instanceof HTMLCanvasElement)) {
      throw new TypeError('Live2D canvas is not available')
    }

    if (this.app?.canvas === view) return

    this.destroy()

    const app = new Application()

    this.app = app

    try {
      await app.init({
        view,
        resizeTo: window,
        backgroundAlpha: 0,
        autoDensity: true,
        resolution: devicePixelRatio,
      })
    } catch (error) {
      if (this.app === app) this.app = null

      app.destroy(false, { children: true, context: true })

      throw error
    }
  }

  public async load(path: string) {
    this.destroyModel()

    await this.initApp()

    const files = await readDir(path)

    const modelFile = files.find(file => file.name.endsWith('.model3.json'))

    if (!modelFile) {
      throw new Error(i18n.global.t('utils.live2d.hints.notFound'))
    }

    const modelPath = join(path, modelFile.name)

    const modelJSON = JSON5.parse(await readTextFile(modelPath))

    const modelSetting = new CubismSetting({
      modelJSON,
    })

    modelSetting.redirectPath(({ file }) => {
      return convertFileSrc(join(path, file))
    })

    this.model = new Live2DSprite({
      modelSetting,
      ticker: Ticker.shared,
    })

    this.app?.stage.addChild(this.model)

    await this.model.ready

    const { width, height } = this.model

    const motions = groupBy(this.model.getMotions(), 'group')
    const expressions = this.model.getExpressions()

    return {
      width,
      height,
      motions,
      expressions,
    }
  }

  public destroy() {
    this.destroyModel()

    const app = this.app

    this.app = null

    app?.destroy(false, { children: true, context: true })
  }

  private destroyModel() {
    if (!this.model) return

    this.model.destroy()

    this.model = null
  }

  public resizeModel(modelSize: ModelSize) {
    if (!this.model) return

    const { width, height } = modelSize

    const scaleX = innerWidth / width
    const scaleY = innerHeight / height
    const scale = Math.min(scaleX, scaleY)

    this.model.scale.set(scale)
    this.model.x = innerWidth / 2
    this.model.y = innerHeight / 2
    this.model.anchor.set(0.5)
  }

  public startMotion(motion: MotionInfo, options: StartMotionOptions = {}) {
    return this.model?.startMotion({
      ...motion,
      priority: options.priority ?? Priority.Normal,
      onFinished: options.onFinished,
    })
  }

  public setExpression(index: number) {
    return this.model?.setExpression({ index })
  }

  public getParameterValueRange(id: string) {
    return this.model?.getParameterValueRangeById(id)
  }

  public setParameterValue(id: string, value: number | boolean) {
    return this.model?.setParameterValueById(id, Number(value))
  }

  public setMotionSoundEnabled(enabled: boolean) {
    Config.MotionSound = enabled
  }

  public setMaxFPS(fps: number) {
    Ticker.shared.maxFPS = fps
  }
}

const live2d = new Live2d()

export default live2d
