import Graph from "./graph";
import ReactiveGraph from "./reactiveGraph";
import ReactiveFunction from "./reactiveFunction";

var reactiveGraph = new ReactiveGraph();

function ReactiveModel(){
  
  // Enforce use of new, so instanceof and typeof checks will work.
  if (!(this instanceof ReactiveModel)) {
    return new ReactiveModel();
  }

  // Refer to `this` (the ReactiveModel instance) as `model` in this closure.
  var model = this;

  // { property -> defaultValue }
  var publicProperties = {};

  var isFinalized = false;

  var values = {};

  // { property -> node }
  var propertyNodes = {};

  function addPublicProperty(property, defaultValue){
    if(isFinalized){
      throw new Error("model.addPublicProperty() is being invoked after model.finalize, but this is not allowed. Public properties may only be added before the model is finalized.");
    }

    publicProperties[property] = defaultValue;
    values[property] = defaultValue;

    return model;
  }

  function createGetterSetters(properties){
    properties.forEach(function (property){
      model[property] = function (value){
        if (!arguments.length) {
          return values[property];
        }
        values[property] = value;

        var node = propertyNodes[property]
        reactiveGraph.changedPropertyNodes[node] = true;

        return model;
      };
    });
  }

  function finalize(){
    if(isFinalized){
      throw new Error("model.finalize() is being invoked " +
        "more than once, but this function should only be invoked once.");
    }
    isFinalized = true;

    createGetterSetters(Object.keys(publicProperties));

    return model;
  }

  function getState(){
    var state = {};
    Object.keys(publicProperties).forEach( function (publicProperty){
      state[publicProperty] = values[publicProperty];
    });
    return state;
  }

  function setState(state){

    // Reset state to default values.
    Object.keys(publicProperties).forEach(function (property){
      var defaultValue = publicProperties[property];
      model[property](defaultValue);
    });

    // Apply values included in the new state.
    Object.keys(state).forEach(function (property){
      var newValue = state[property]
      model[property](newValue);
    });

    return model;
  }

  function react(options){
    var reactiveFunctions = ReactiveFunction.parse(options);
    reactiveFunctions.forEach(function (reactiveFunction){

      // TODO refactor this into "track()",
      // and only create getter-setters once for each property
      createGetterSetters(reactiveFunction.inProperties);
      createGetterSetters([reactiveFunction.outProperty]);

      assignNodes(reactiveFunction);

      reactiveGraph.addReactiveFunction(reactiveFunction);

      reactiveFunction.inNodes.forEach(function (node){
        reactiveGraph.changedPropertyNodes[node] = true;
      });
    });
  }

  function getOrCreatePropertyNode(property){
    if(property in propertyNodes){
      return propertyNodes[property];
    } else {
      var propertyNode = reactiveGraph.makePropertyNode(model[property]);
      propertyNodes[property] = propertyNode;
      return propertyNode;
    }
  }

  function assignNodes(reactiveFunction){
    reactiveFunction.inNodes = reactiveFunction.inProperties.map(getOrCreatePropertyNode);
    reactiveFunction.node = reactiveGraph.makeReactiveFunctionNode(reactiveFunction);
    reactiveFunction.outNode = getOrCreatePropertyNode(reactiveFunction.outProperty);
  }

  model.addPublicProperty = addPublicProperty;
  model.finalize = finalize;
  model.getState = getState;
  model.setState = setState;
  model.react = react;
}

ReactiveModel.digest = reactiveGraph.digest;

// Export these internal modules for unit testing via Rollup CommonJS build.
ReactiveModel.Graph = Graph;
ReactiveModel.ReactiveGraph = ReactiveGraph;
ReactiveModel.ReactiveFunction = ReactiveFunction;

export default ReactiveModel;
