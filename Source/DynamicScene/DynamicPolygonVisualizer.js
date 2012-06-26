/*global define*/
define([
        '../Core/DeveloperError',
        '../Core/destroyObject',
        '../Scene/Polygon',
        '../Scene/ColorMaterial'
       ], function(
         DeveloperError,
         destroyObject,
         Polygon,
         ColorMaterial) {
    "use strict";

    /**
     * A DynamicObject visualizer which maps the DynamicPolygon instance
     * in DynamicObject.polygon to a Polygon primitive.
     *
     * @param {Scene} scene The scene the primitives will be rendered in.
     * @param {DynamicObjectCollection} [dynamicObjectCollection] The dynamicObjectCollection to visualize.
     *
     * @exception {DeveloperError} scene is required.
     *
     * @see DynamicPolygon
     * @see Scene
     * @see DynamicObject
     * @see DynamicObjectCollection
     * @see CompositeDynamicObjectCollection
     * @see VisualizerCollection
     * @see DynamicBillboardVisualizer
     * @see DynamicConeVisualizer
     * @see DynamicConeVisualizerUsingCustomSensorr
     * @see DynamicLabelVisualizer
     * @see DynamicPointVisualizer
     * @see DynamicPolylineVisualizer
     * @see DynamicPyramidVisualizer
     *
     */
    function DynamicPolygonVisualizer(scene, dynamicObjectCollection) {
        this._scene = scene;
        this._unusedIndexes = [];
        this._primitives = scene.getPrimitives();
        this._polygonCollection = [];
        this._dynamicObjectCollection = undefined;
        this.setDynamicObjectCollection(dynamicObjectCollection);
    }

    /**
     * Returns the scene being used by this visualizer.
     *
     * @returns {Scene} The scene being used by this visualizer.
     */
    DynamicPolygonVisualizer.prototype.getScene = function() {
        return this._scene;
    };

    /**
     * Gets the DynamicObjectCollection being visualized.
     *
     * @returns {DynamicObjectCollection} The DynamicObjectCollection being visualized.
     */
    DynamicPolygonVisualizer.prototype.getDynamicObjectCollection = function() {
        return this._dynamicObjectCollection;
    };

    /**
     * Sets the DynamicObjectCollection to visualize.
     *
     * @param dynamicObjectCollection The DynamicObjectCollection to visualizer.
     */
    DynamicPolygonVisualizer.prototype.setDynamicObjectCollection = function(dynamicObjectCollection) {
        var oldCollection = this._dynamicObjectCollection;
        if (oldCollection !== dynamicObjectCollection) {
            if (typeof oldCollection !== 'undefined') {
                oldCollection.objectsRemoved.removeEventListener(DynamicPolygonVisualizer.prototype._onObjectsRemoved);
                this.removeAll();
            }
            this._dynamicObjectCollection = dynamicObjectCollection;
            if (typeof dynamicObjectCollection !== 'undefined') {
                dynamicObjectCollection.objectsRemoved.addEventListener(DynamicPolygonVisualizer.prototype._onObjectsRemoved, this);
            }
        }
    };

    /**
     * Updates all of the primitives created by this visualizer to match their
     * DynamicObject counterpart at the given time.
     *
     * @param {JulianDate} time The time to update to.
     *
     * @exception {DeveloperError} time is required.
     */
    DynamicPolygonVisualizer.prototype.update = function(time) {
        if (typeof time === 'undefined') {
            throw new DeveloperError('time is requied.');
        }
        if (typeof this._dynamicObjectCollection !== 'undefined') {
            var dynamicObjects = this._dynamicObjectCollection.getObjects();
            for ( var i = 0, len = dynamicObjects.length; i < len; i++) {
                this._updateObject(time, dynamicObjects[i]);
            }
        }
    };

    /**
     * Removes all primitives from the scene.
     */
    DynamicPolygonVisualizer.prototype.removeAll = function() {
        var i, len;
        for (i = 0, len = this._polygonCollection.length; i < len; i++) {
            this._primitives.remove(this._polygonCollection[i]);
        }

        var dynamicObjects = this._dynamicObjectCollection.getObjects();
        for (i = dynamicObjects.length - 1; i > -1; i--) {
            dynamicObjects[i].polygonVisualizerIndex = undefined;
        }

        this._unusedIndexes = [];
        this._polygonCollection = [];
    };

    /**
     * Returns true if this object was destroyed; otherwise, false.
     * <br /><br />
     * If this object was destroyed, it should not be used; calling any function other than
     * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.
     *
     * @memberof DynamicPolygonVisualizer
     *
     * @return {Boolean} True if this object was destroyed; otherwise, false.
     *
     * @see DynamicPolygonVisualizer#destroy
     */
    DynamicPolygonVisualizer.prototype.isDestroyed = function() {
        return false;
    };

    /**
     * Destroys the WebGL resources held by this object.  Destroying an object allows for deterministic
     * release of WebGL resources, instead of relying on the garbage collector to destroy this object.
     * <br /><br />
     * Once an object is destroyed, it should not be used; calling any function other than
     * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.  Therefore,
     * assign the return value (<code>undefined</code>) to the object as done in the example.
     *
     * @memberof DynamicPolygonVisualizer
     *
     * @return {undefined}
     *
     * @exception {DeveloperError} This object was destroyed, i.e., destroy() was called.
     *
     * @see DynamicPolygonVisualizer#isDestroyed
     *
     * @example
     * visualizer = visualizer && visualizer.destroy();
     */
    DynamicPolygonVisualizer.prototype.destroy = function() {
        this.removeAll();
        return destroyObject(this);
    };

    DynamicPolygonVisualizer.prototype._updateObject = function(time, dynamicObject) {
        var dynamicPolygon = dynamicObject.polygon;
        if (typeof dynamicPolygon === 'undefined') {
            return;
        }

        var vertexPositionsProperty = dynamicObject.vertexPositions;
        if (typeof vertexPositionsProperty === 'undefined') {
            return;
        }

        var polygon;
        var showProperty = dynamicPolygon.show;
        var polygonVisualizerIndex = dynamicObject.polygonVisualizerIndex;
        var show = dynamicObject.isAvailable(time) && (typeof showProperty === 'undefined' || showProperty.getValue(time));

        if (!show) {
            //don't bother creating or updating anything else
            if (typeof polygonVisualizerIndex !== 'undefined') {
                polygon = this._polygonCollection[polygonVisualizerIndex];
                polygon.show = false;
                dynamicObject.polygonVisualizerIndex = undefined;
                this._unusedIndexes.push(polygonVisualizerIndex);
            }
            return;
        }

        if (typeof polygonVisualizerIndex === 'undefined') {
            var unusedIndexes = this._unusedIndexes;
            var length = unusedIndexes.length;
            if (length > 0) {
                polygonVisualizerIndex = unusedIndexes.pop();
                polygon = this._polygonCollection[polygonVisualizerIndex];
            } else {
                polygonVisualizerIndex = this._polygonCollection.length;
                polygon = new Polygon();
                this._polygonCollection.push(polygon);
                this._primitives.add(polygon);
            }
            dynamicObject.polygonVisualizerIndex = polygonVisualizerIndex;
            polygon.dynamicObject = dynamicObject;

            // CZML_TODO Determine official defaults
            polygon.material = new ColorMaterial();
        } else {
            polygon = this._polygonCollection[polygonVisualizerIndex];
        }

        polygon.show = true;

        var value = vertexPositionsProperty.getValueCartesian(time);
        if (typeof value !== 'undefined' && polygon.last_position !== value) {
            polygon.setPositions(value);
            polygon.last_position = value;
        }

        var material = dynamicPolygon.material;
        if (typeof material !== 'undefined') {
            polygon.material = material.getValue(time, this._scene, polygon.material);
        }
    };

    DynamicPolygonVisualizer.prototype._onObjectsRemoved = function(dynamicObjectCollection, dynamicObjects) {
        var thisPolygonCollection = this._polygonCollection;
        var thisUnusedIndexes = this._unusedIndexes;
        for ( var i = dynamicObjects.length - 1; i > -1; i--) {
            var dynamicObject = dynamicObjects[i];
            var polygonVisualizerIndex = dynamicObject.polygonVisualizerIndex;
            if (typeof polygonVisualizerIndex !== 'undefined') {
                var polygon = thisPolygonCollection[polygonVisualizerIndex];
                polygon.show = false;
                thisUnusedIndexes.push(polygonVisualizerIndex);
                dynamicObject.polygonVisualizerIndex = undefined;
            }
        }
    };

    return DynamicPolygonVisualizer;
});