redis-modelize
==============

Represent your model as a json object, using redis as backend.

This tool was thought for implementing complex models on a fast backend as redis.

## Install

To install with npm, type

```
npm install redis-modelize
```

## Usage
### Basics
Inside your project, type

```
var rm = require('redis-modelize');
var model = rm.init(modelObj, {prefix: 'optional:some:redis:prefix'});
var redis-client = rm.client;
```

`rm.client` part of the code returns the instance of redis client that this module uses internally. 

**modelObj** is the object that describes your model. For example:

```
//Define your model
var modelObj = {
	global: {
		keywords: {type: 'set'}
	}
};

//modelize
var model = rm.init(modelObj, {prefix: 'prefix'});

//Now you have methods to interact with redis
new model.gobal().setKeywords(['any', 'array', 'of', 'keywords'], function(err, resp) {
  /*this is a callback*/
});
```

The hierarchy of the model object is:

modelObj => namespace => property

So in this example, **global** is the *namespace*, and **keywords** is the *property*. When you modelize, you get a constructor with each namespace defined, and get several methods for each property.

As you can imagine, what **setKeywords** method of the example really does under the hood, is 
```
redis.sadd('prefix:global:keywords', ['any', 'array', 'of', 'keywords'], callback);
```


*How does it know that you want to use __sadd__?*

Because we defined that the property **keywords** is of type **set**.

Posible values for **type** are (the redis types): *string*, *set*, *list*, *zset* and *hash*.

Depending on which *type* you define your property, are the ammount of methods you get to manipulate it. 

The last parameter of **all** methods is a *callback* function with the signature `function(err, resp)`.

### Complicating things
Ok, this example is kind of too simple and really it's an overkill when you can simply use redis module.. lets make things a little more complicated.

Imagine we have

```
var modelObj = {
	user: {
		_obj: {
			type: 'hash',
			reverse: ['email'],
			props: {
				fullname: {mandatory: true},
				email: {mandatory: true},
				password: {mandatory: true}
				phone: {mandatory: false}
			}
		},
		projects: {type: 'set', refs: true}
	},
	project: {
		_obj: {
			type: 'hash',
			props: {
				name: {mandatory: true},
				user: {refs: true},
				description: {mandatory: false}
			}
		}
	},
	global: {
                keywords: {type: 'set'}
	}
}

var model = rm.init(modelObj);
```
Now things get interesting...

Fist of all, the only **type** that requires different ammount of *parameters* is **hash**.

Parameters for properties of type:

* **hash**: 
  1. *type*: **mandatory**. Defines the type. In this case 'hash'.
  2. *props*: **mandatory**. Represent the fields of this hash object. You can define each field with `{refs: true|false}`. If **refs** is *true*, your property will get two extra methods, called *'getRef'+\<field name with first letter in upper case\>* and *'setRef'+\<field name with first letter in upper case\>*. I'll explain them later.
* **any other type**:
  1. *type*: **mandatory**. Defines the type.
  2. *refs*: **optional**. Same as above, but the methods will be named with property name.

Of coure, you can add any parameter you like, but they will not be considered.

### WTF is _obj?

Ok, now lets explain the **_obj** property that you see in **user** and **project**. 

The **_obj** property is the only one that has special meaning. You can think of it as the constructor of a class.

With the model of the previous example, you could do the following:

```
new model.user({
  fullname: 'John Doe', 
  email: 'john.doe@example.com', 
  password: hashlib.md5('password')
});
```

Simple, isn't it? But there are some special considerations of the **_obj** property:

* **_obj** property must be of type 'hash'.
* Fields in **_obj** property may be defined with **refs**, like a normal hash, and also with the optional parameter **mandatory**. 
  If a field is defined as mandatory, and it wasn't included in the constructor, it will thow an error.
* **_obj** property may include the parameter **reverse**. 
  This parameter can be a string, or an array of strings and they must match the name of a field defined in **props**. 
  If this parameter is present, you get the static method **reverse**. You could use it like this: 
```
model.user.reverse('john.doe@example.com', function(err, id) { 
	var johnDoeUser = this 
});
```
* If you defined **_obj** property, you get the method **get** that returns all the fields of the instance, defined in the **_obj**, as a json object. You could use it like this:
```
model.user.reverse('john.doe@example.com', function(err, id) { 
	//'this' references an instance of user.
        this.get(function(err, userFields) {
		console.log(userFields.fullname); //Prints 'John Doe'
	});
});
```
* As a final offer, you also get a new method called **getParams**. It simply returns all the fields as you defined them in the model object. 
  This may be useful if you want to process something according to parameters.. for example, if you want to dynamically create forms according the parameters you defined in _obj.

### Manipulating data

Ok, suppose now that you know John Doe's id is *1*... an other way of getting an instance of user with John Doe's data is 
```
new model.user(1, function(err, id) { ... });
``` 

This means, that if the parameter you pass to the constructor is not an object, it takes it as an identifier.

Fields of hash objects also get methods to manipulate them. In this example, you could add phone number to John doing 
```
//set phone number within callback function
new model.user(1, function(err, id) {
	this.setPhone('555-555555');
});

//or set phone number directly
new model.user(1).setPhone('555-555555');
```

### Refs

If a property or a field was defined with *refs: true*, it means that it gets two special methods: *setRef+<name with first upper case>* and *getRef+<name with first upper case>*. What it means is that the property/field references an object in the model. You could use it like this:

```
//add a project to John Doe
var jdUser = new model.user(1);
var awproj = new model.project(
	{
		name: 'Awesome Project', 
		description: 'This project will be awesome'
	}, 
	function(err, id) {
	
	this.setRefUser(jdUser);
	jdUser.setRefProjects(this);

});
``` 

If you later do `awproj.getRefUser(function(err, refUserInstance){ ... })`  the second argument of the callback function is an instance of the referenced user.

## Help!

Any suggestions, bug reports, bug fixes, etc, are very wellcome ([here](https://github.com/agmoyano/redis-modelize/issues)).

Thanks for reading!.
