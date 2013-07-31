var redis = require('redis');
var client = exports.client = redis.createClient();
var util = require("util");
var events = require("events");
//var i18n = require('i18next');

/*i18n.init({
  saveMissing: true,
  debug: true,
  sendMissingTo: 'all'
});*/
/*
 * GET users listing.
 */


//Edit model to your needs

exports.init = function(modelObj, options) {
  var model={};
  var prefix = (options && options.prefix)?options.prefix:'';
  if(prefix && !/.*:$/.test(prefix)) {
    prefix = prefix+':';
  }
  for(var i in modelObj) {
    (function(name, element) {
      var prot;
      //if(element._obj) {
      model[name] = function(params, callback) {
	if(typeof params == 'function' && !callback) {
	  params.call(this, null, null);
	} else if(typeof params == 'string'||typeof params == 'number') {
	  this.id = params;
	  this.type = name;
	  callback && callback.call(this, null, this.id);
	} else if(typeof params == 'object' && element._obj) {
	  for(var i in element._obj.props) {
	    if(element._obj.props[i].mandatory && !params[i]) {
	      throw 'Parameter '+i+' is mandatory';
	    }
	  }
	  var e = this;
	  client.incr(prefix+'global:'+name+':id', function(err, res) {
	    if(!err) {
	      e.id = res;
	      e.type = name;
	      if(element._obj.reverse) {
		if(!util.isArray(element._obj.reverse)) {
			element._obj.reverse = [element._obj.reverse];
		}
		var parts = ['global'];
		for(var i = 0; i<element._obj.reverse.length; i++) {
		  parts.push(params[element._obj.reverse[i]]);
		}
		parts.push(name);
		client.set(prefix+parts.join(':'), res);
	      }
	      client.hmset(prefix+name+':'+e.id+':_obj', params);
	      callback && callback.call(e, null, e.id);
	    } else {
	      callback && callback.call(e, err, null);
	    }
	  });
	}
      };
      util.inherits(model[name], events.EventEmitter);
      if(element._obj) {
	model[name].getParams = function() {
	  return element._obj.props;
	};
	if(element._obj.reverse) {
	  model[name].reverse = function(parts, callback) {
	    if(!util.isArray(parts)) {
	      parts = [parts];
	    }
	    parts.unshift('global');
	    parts.push(name);
	    client.get(prefix+parts.join(':'), function(err, uid) {
	      if(!err && uid) {
		new model[name](uid, callback);
	      } else {
		callback && callback.call(this, err, null);
	      }
	    });
	  }
	}
      }
      /*} else {
	model[name] = new events.EventEmitter();
	model[name].type = name;
      }*/
      prot = model[name].prototype || model[name].__proto__;
      
      
      prot.del = function(callback) {
	for(var j in element) {
	  var cap = j.charAt(0).toUpperCase()+j.slice(1);
	  this['del'+cap]();
	}
	this.emit('del');
	callback && callback.call(this);
      };
      
      if(element._obj) {
	prot.get = function(id, callback) {
	  if(!callback && typeof id == 'function') {
	    callback = id;
	    id = this.id;
	  }
	  if(id && callback) {
	    var e = this;
	    client.hgetall(prefix+name+':'+id+':_obj', function(err, obj) {
		callback.call(e, err, obj);
	    });
	  }
	};
      }
      
      for(var j in element) {
	(function(element, j) {
	  var cap = j.charAt(0).toUpperCase()+j.slice(1);
	  
	  prot['_key'+cap] = function() {
	    return prefix+(this.id?name+':'+this.id+':'+j:name+':'+j);
	  };
	  
	  prot['del'+cap] = function(callback) {
	    var e = this;
	    return client.del(this['_key'+cap](), function(err, res) {
	      e.emit('del'+cap, err, res);
	      callback && callback.call(e, err, res);
	    });
	  };
	  
	  switch(element[j].type) {
	    case "string": 
	      prot['set'+cap] = function(value, callback) {
		var e = this;
		client.set(this['_key'+cap](), value, function(err, res) {
		  e.emit('set'+cap, err, res);
		  callback && callback.call(e, err, res);
		});
	      };
	      
	      prot['get'+cap] = function(callback) {
		var e = this;
		client.get(this['_key'+cap](), function(err, res) {
		  e.emit('get'+cap, err, res);
		  callback && callback.call(e, err, res);
		});
	      };
	      
	      if(element[j].refs) {
		prot['setRef'+cap] = function(obj, callback) {
		  var value = obj.type+":"+obj.id;
		  this['set'+cap](value, callback);
		};
		
		prot['getRef'+cap] = function(callback) {
		  this['get'+cap](function(err, res) {
		    var response=null;
		    if(typeof res == 'string') {
		      var val = res.split(':');
		      response = new model[val[0]](val[1]);
		    }
		    this.emit('getRef'+cap, err, response);
		    callback && callback.call(this, err, response);
		  })
		};
	      }
	      break;
	    case "list":
	      break;
	    case "set":
	      prot['set'+cap] = function(value, callback) {
		var e = this;
		client.sadd(this['_key'+cap](), value, function(err, res) {
		  e.emit('set'+cap, err, res);
		  callback && callback.call(e, err, res);
		});
	      };
	      
	      
	      prot['get'+cap] = function(callback) {
		var e = this;
		client.smembers(this['_key'+cap](), function(err, res) {
		  e.emit('get'+cap, err, res);
		  callback && callback.call(e, err, res);
		});
	      };
	      
	      prot['in'+cap] = function(value, callback) {
		var e = this;
		client.sismember(this['_key'+cap](), value, function(err, res) {
		  e.emit('in'+cap, err, res);
		  callback && callback.call(e, err, res);
		});
	      };
	      
	      prot['rem'+cap] = function(values, callback) {
		var e = this;
		client.srem(this['_key'+cap](), values, function(err, res) {
		  e.emit('rem'+cap, err, res);
		  callback && callback.call(e, err, res);
		});
	      };
	      
	      if(element[j].refs) {
		prot['setRef'+cap] = function(objs, callback) {
		  if(typeof objs != "array") {
		    objs = [objs];
		  }
		  objs.forEach(function(o, i) {
		    objs[i] = o.type+":"+o.id;
		  });
		  this['set'+cap](objs, callback);
		};
		
		prot['getRef'+cap] = function(callback) {
		  this['get'+cap](function(err, res) {
		    var response=null;
		    if(typeof res == 'string') {
		      var val = res.split(':');
		      response=new model[val[0]](val[1]);
		    } else if(typeof res == 'array') {
		      response = [];
		      res.forEach(function(r){
			var val = r.split(':');
			response.push(new model[val[0]](val[1]));
		      });
		    }
		    this.emit('getRef'+cap, err, response);
		    callback && callback.call(this, err, response);
		  })
		};
		
		prot['remRef'+cap] = function(objs, callback) {
		  if(typeof objs != "array") {
		    objs = [objs];
		  }
		  objs.forEach(function(o, i) {
		    objs[i] = o.type+":"+o.id;
		  });
		  this['rem'+cap](objs, callback);
		};
	      }
	      break;
	    case "zset":
	      prot['set'+cap] = function(value, callback) {
		var e = this;
		client.zadd(this['_key'+cap](), value, function(err, res) {
		  e.emit('set'+cap, err, res);
		  callback && callback.call(e, err, res);
		});
	      };
	      
	      //Ascending by index
	      prot['getAI'+cap] = function(start, stop, callback) {
		var e = this;
		client.zrange(this['_key'+cap](), start, stop, function(err, res) {
		  e.emit('getAI'+cap, err, res);
		  callback && callback.call(e, err, res);
		});
	      };
	      
	      //Descending by index
	      prot['getDI'+cap] = function(start, stop, callback) {
		var e = this;
		client.zrevrange(this['_key'+cap](), start, stop, function(err, res) {
		  e.emit('getAI'+cap, err, res);
		  callback && callback.call(e, err, res);
		});
	      };
	      
	      //Ascending by score
	      prot['getAS'+cap] = function(min, max, callback) {
		var e = this;
		client.zrangebyscore(this['_key'+cap](), min, max, function(err, res) {
		  e.emit('getAS'+cap, err, res);
		  callback && callback.call(e, err, res);
		});
	      };
	      
	      //Descending by score
	      prot['getDS'+cap] = function(min, max, callback) {
		var e = this;
		client.zrevrangebyscore(this['_key'+cap](), min, max, function(err, res) {
		  e.emit('getDS'+cap, err, res);
		  callback && callback.call(e, err, res);
		});
	      };
	      
	      prot['rem'+cap] = function(values, callback) {
		var e = this;
		client.zrem(this['_key'+cap](), values, function(err, res) {
		  e.emit('rem'+cap, err, res);
		  callback && callback.call(e, err, res);
		});
	      };
	      
	      prot['remI'+cap] = function(start, stop, callback) {
		var e = this;
		client.zremrangebyrank(this['_key'+cap](), start, stop, function(err, res) {
		  e.emit('remI'+cap, err, res);
		  callback && callback.call(e, err, res);
		});
	      };
	      
	      prot['remS'+cap] = function(min, max, callback) {
		var e = this;
		client.zremrangebyscore(this['_key'+cap](), min, max, function(err, res) {
		  e.emit('remI'+cap, err, res);
		  callback && callback.call(e, err, res);
		});
	      };
	      
	      if(element[j].refs) {
		prot['setRef'+cap] = function(objs, callback) {
		  if(typeof objs != "array") {
		    objs = [objs];
		  }
		  objs.forEach(function(o, i) {
		    objs[i] = o.type+":"+o.id;
		  });
		  this['set'+cap](objs, callback);
		};
		
		prot['getRef'+cap] = function(callback) {
		  this['get'+cap](function(err, res) {
		    var response=null;
		    if(typeof res == 'string') {
		      var val = res.split(':');
		      response=new model[val[0]](val[1]);
		    } else if(typeof res == 'array') {
		      response = [];
		      res.forEach(function(r){
			var val = r.split(':');
			response.push(new model[val[0]](val[1]));
		      });
		    }
		    this.emit('getRef'+cap, err, response);
		    callback && callback.call(this, err, response);
		  })
		};
		
		prot['remRef'+cap] = function(objs, callback) {
		  if(typeof objs != "array") {
		    objs = [objs];
		  }
		  objs.forEach(function(o, i) {
		    objs[i] = o.type+":"+o.id;
		  });
		  this['rem'+cap](objs, callback);
		};
	      }
	      break;
	    case "hash":
	      prot['set'+cap] = function(value, callback) {
		var key = this['_key'+cap]();
		var e = this;
		client.hmset(key, value, function(err, res) {
		  e.emit('set'+cap, err, res);
		  callback && callback.call(e, err, res);
		});
	      };
	      
	      prot['get'+cap] = function(callback) {
		var key = this['_key'+cap]();
		var e = this;
		client.hgetall(key, function(err, res) {
		  e.emit('get'+cap, err, res);
		  callback && callback.call(e, err, res);
		});
	      };
	      
	      for(var k in element[j].props) {
		(function(propName, prop) {
		  var pcap = propName.charAt(0).toUpperCase()+propName.slice(1);
		  prot['set'+pcap] = function(value, callback) {
		    var key = this['_key'+cap]();
		    var e = this;
		    client.hset(key, propName, value, function(err, res) {
		      e.emit('set'+pcap, err, res);
		      callback && callback.call(e, err, res);
		    });
		  };
		  
		  prot['get'+pcap] = function(callback) {
		    var key = this['_key'+cap]();
		    var e = this;
		    client.hget(key, propName, function(err, res) {
		      e.emit('get'+pcap, err, res);
		      callback && callback.call(e, err, res);
		    });
		  };
		  
		  if(prop.refs) {
		    prot['setRef'+pcap] = function(obj, callback) {
		      var value = obj.type+":"+obj.id;
		      this['set'+pcap](value, callback);
		    };
		    
		    prot['getRef'+pcap] = function(callback) {
		      this['get'+pcap](function(err, res) {
			var response=null;
			if(typeof res == 'string') {
			  var val = res.split(':');
			  response = new model[val[0]](val[1]);
			}
			this.emit('getRef'+pcap, err, response);
			callback && callback.call(this, err, response);
		      })
		    };
		  }
		})(k, element[j].props[k]);
	      }
	      break;
	  }
	})(element, j);
      }
    })(i, modelObj[i]);
  }
  return model;
}
