import EventEmitter from './EventEmitter.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

export default class Loader extends EventEmitter
{
    constructor()
    {
        super()

        this.setLoaders()
    }

    setLoaders()
    {
        const decoderBasePath = `${import.meta.env.BASE_URL || '/'}draco/gltf/`

        this.dracoLoader = new DRACOLoader()
        this.dracoLoader.setDecoderPath(decoderBasePath)
        this.dracoLoader.setDecoderConfig({ type: 'wasm' })
        this.dracoLoader.preload()

        this.gltfLoader = new GLTFLoader()
        this.gltfLoader.setDRACOLoader(this.dracoLoader)

        this.fbxLoader = new FBXLoader()

        this.loaders = [
            {
                extensions: ['jpg', 'jpeg', 'png', 'webp'],
                action: (_resource) => this.loadImage(_resource)
            },
            {
                extensions: ['drc'],
                action: (_resource) => this.loadDraco(_resource)
            },
            {
                extensions: ['glb', 'gltf'],
                action: (_resource) => this.loadGltf(_resource)
            },
            {
                extensions: ['fbx'],
                action: (_resource) => this.loadFbx(_resource)
            }
        ]
    }

    load(_resources = [], _options = {})
    {
        const batch = _options.batch || 'default'
        const total = _resources.length

        if(total === 0)
        {
            return Promise.resolve({ batch, total, loaded: 0, failed: [] })
        }

        let settled = 0

        const requests = _resources.map((_resource) =>
        {
            return this.loadResource(_resource)
                .then((_data) =>
                {
                    this.trigger('fileEnd', [_resource, _data, batch])
                    return { resource: _resource, data: _data }
                })
                .catch((_error) =>
                {
                    const error = this.createResourceError(_resource, _error)
                    this.trigger('fileError', [_resource, error, batch])
                    throw error
                })
                .finally(() =>
                {
                    settled++
                    this.trigger('progress', [{
                        batch,
                        loaded: settled,
                        total,
                        ratio: settled / total,
                        resource: _resource
                    }])
                })
        })

        return Promise.allSettled(requests).then((_results) =>
        {
            const failed = _results
                .filter((_result) => _result.status === 'rejected')
                .map((_result) => _result.reason)

            const summary = {
                batch,
                total,
                loaded: total - failed.length,
                failed
            }

            if(failed.length > 0)
            {
                throw new AggregateError(failed, `Failed to load ${failed.length} ${batch} asset${failed.length === 1 ? '' : 's'}`)
            }

            return summary
        })
    }

    loadResource(_resource)
    {
        const extensionMatch = _resource.source.match(/\.([a-z0-9]+)(?:[?#].*)?$/i)
        const extension = extensionMatch ? extensionMatch[1].toLowerCase() : null
        const loader = this.loaders.find((_loader) => _loader.extensions.includes(extension))

        if(!loader)
        {
            return Promise.reject(new Error(`No loader is registered for ${_resource.source}`))
        }

        return loader.action(_resource)
    }

    loadImage(_resource)
    {
        return new Promise((_resolve, _reject) =>
        {
            const image = new Image()
            image.decoding = 'async'
            image.addEventListener('load', () => _resolve(image), { once: true })
            image.addEventListener('error', () => _reject(new Error('Image request failed')), { once: true })
            image.src = _resource.source
        })
    }

    loadDraco(_resource)
    {
        return new Promise((_resolve, _reject) =>
        {
            this.dracoLoader.load(_resource.source, _resolve, undefined, _reject)
        })
    }

    loadGltf(_resource)
    {
        return new Promise((_resolve, _reject) =>
        {
            this.gltfLoader.load(_resource.source, _resolve, undefined, _reject)
        })
    }

    loadFbx(_resource)
    {
        return new Promise((_resolve, _reject) =>
        {
            this.fbxLoader.load(_resource.source, _resolve, undefined, _reject)
        })
    }

    createResourceError(_resource, _error)
    {
        const reason = _error instanceof Error ? _error.message : `${_error}`
        const error = new Error(`Unable to load ${_resource.name} (${_resource.source}): ${reason}`)
        error.cause = _error
        error.resource = _resource
        return error
    }

    dispose()
    {
        this.dracoLoader.dispose()
        this.off('fileEnd fileError progress')
    }
}
