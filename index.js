const tuya = require('homebridge-tuyapi-extended');

var Accessory,
     Service,
     Characteristic,
     UUIDGen;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-Oittm-Humidifier", "OittmHumidifier", OittmHumidifier);
}

function OittmHumidifier(log, config) {
  // Setup this up.
  this.log = log;
  this.name = config.name;
  this.config = config;
  this.log.prefix = 'Oittm Humidifier - ' + this.name;

  const debug = require('debug')('[Tuya Color Light - '  + this.name + ' ]  ');

  this.debugging = config.debug || false;
  this.debugPrefix = config.debugPrefix || '~~~  '

  this.deviceEnabled = (typeof config.deviceEnabled === 'undefined') ? true : config.deviceEnabled;

  this.devId = config.devId;
  this.powerState = true;

  this.dps = {};

  this.powerState = false;
  this.noUpdate = false;

  this.refreshInterval = (config.refreshInterval !== undefined) ? config.refreshInterval : 60;  // Seconds

  // API timeout settings, tweak via config.
  this.apiMinTimeout = (typeof config.apiMinTimeout === undefined) ? 100 : config.apiMinTimeout;
  this.apiMaxTimeout = (typeof config.apiMaxTimeout  === undefined) ? 2000 : config.apiMaxTimeout;
  this.apiRetries = (typeof config.apiRetries === undefined) ? 1 : config.apiRetries;
  this.apiDebug = config.apiDebug || false;

  // this.tuyaDebug(JSON.stringify(config));

  // Setup Tuya Color Light
  if (config.ip != undefined && this.deviceEnabled === true) {
    this.tuyaDebug('Tuya Color Light ' + this.name + ' Ip is defined as ' + config.ip);
    this.OittmHumidifier = new tuya({type: 'color-lightbulb', ip: config.ip, id: config.devId, key: config.localKey, name: this.name, apiRetries: this.apiRetries, apiMinTimeout: this.apiMinTimeout, apiMaxTimeout: this.apiMaxTimeout, apiDebug: this.apiDebug, apiDebugPrefix: this.debugPrefix});
  } else if(this.deviceEnabled === true) {
    this.tuyaDebug('Tuya Color Light ' + this.name + ' IP is undefined, resolving Ids and this usually does not work, so set a static IP for your powerstrip and add it to the config...');
    this.OittmHumidifier = new tuya({type: 'color-lightbulb', id: config.devId, key: config.localKey, name: this.name, apiRetries: this.apiRetries, apiMinTimeout: this.apiMinTimeout, apiMaxTimeout: this.apiMaxTimeout, apiDebug: this.apiDebug, apiDebugPrefix: this.debugPrefix});
    this.OittmHumidifier.resolveIds(); // This method sucks... it hangs, it doesn't resolve properly. Fix it.
  }

  if(this.debugging === true && this.apiDebug === true && this.deviceEnabled === true) {
    this.tuyaDebug('Tuya API Settings - Retries: ' + this.apiRetries + ' Debug: ' + this.apiDebug + ' Min Timeout: ' + this.apiMinTimeout + ' Max Timeout: ' + this.apiMaxTimeout);
  }

  //this.devicePolling();
  setInterval(this.devicePolling.bind(this), this.refreshInterval * 1000);


};

OittmHumidifier.prototype.getCurrentHumidifierDehumidifierState = function(callback) {
  if(this.deviceEnabled === false) {
    this.log.warn('Device is disabled... Bailing out...');
    return callback('Disabled');
  }


  this.OittmHumidifier.get(this, {schema: true}).then(status => {
    this.tuyaDebug('BEGIN HUMIDIFER STATUS ' + this.debugPrefix);
    var powerState = this.powerState;
	var fanmode = this.fanmode;
	var led_status = this.led_status;
	var unknown = this.unknown;
	var water_shortage = this.water_shortage;

    if(status !== undefined) {
      if(status.dps['1'] !== undefined) {
        powerState = status.dps['1'];
        this.powerState = status.dps['1'];
      }

      if(status.dps['6'] !== undefined) {
		  fanmode = status.dps['6'];
        this.fanmode = status.dps['6'];
      }

      if(status.dps['11'] !== undefined) {
		  led_status = status.dps['11'];
        this.led_status = status.dps['11'];
      }
      
      if(status.dps['12'] !== undefined) {
		  unknown = status.dps['12'];
        this.unknown = status.dps['12'];
      }
      
	  if(status.dps['101'] !== undefined) {
		  water_shortage = status.dps['101'];
        this.water_shortage = status.dps['101'];
      }

      if(!this.debugging) {
        this.log.info('Received update for Humidifier');
      } else {
        this.tuyaDebug('Factored Results ' + this.name + ' device properties...');
        this.tuyaDebug('[1] Power: ' + powerState);
        this.tuyaDebug('[6] Fan Mode: ' + fanmode);
        this.tuyaDebug('[11] LED: ' + status.dps['11']);
        this.tuyaDebug('[12] ?????: ' + status.dps['12']);
        this.tuyaDebug('[101] water shortage: ' + status.dps['101']);

      }
  
    } 

    this.tuyaDebug('END TUYA HUMIDIFIER STATUS ' + this.debugPrefix);


    this.powerState = powerState;
    

    callback(null, powerState === true ? Characteristic.CurrentHumidifierDehumidifierState.HUMIDIFYING : Characteristic.CurrentHumidifierDehumidifierState.INACTIVE );

  }).catch(error => {
    if(error) {
      this.tuyaDebug('BEGIN TUYA GET HUMIDIFIER STATUS ERROR ' + this.debugPrefix);
      this.tuyaDebug('Got Tuya humidifier device ERROR for ' + this.name);
      this.tuyaDebug(error);
      this.tuyaDebug('END TUYA GET HUMIDIFIER POWER STATUS ERROR ' + this.debugPrefix);
      if(!this.debugging) {
        this.log.warn(error.message);
      }
      callback(error, null);
    }
  });
};


// MARK: - ON / OFF

OittmHumidifier.prototype.getActive = function(callback) {

  if(this.deviceEnabled === true) {
    this.OittmHumidifier.get(this, ["dps['1']"]).then(status => {
      this.tuyaDebug('TUYA GET HUMIDIFIER POWER for ' + this.name + ' dps: 1'  + this.debugPrefix);
      this.tuyaDebug('Returned Status: ' + status);
      this.tuyaDebug('END TUYA GET HUMIDIFER POWER ' + this.debugPrefix);
      callback(null, status);
      
    }).catch(error => {
        this.tuyaDebug('TUYA GET HUMIDIFIER POWER ERROR for ' + this.name + ' dps: 1');
        this.tuyaDebug(error.message);
        this.tuyaDebug('END TUYA GET HUMIDIFIER POWER ERROR ' + this.debugPrefix);
        return callback(error);
    });
  } else {
    this.log.warn('Device is disabled... Bailing out...');
    return callback('Device is disabled...');
  }
}

OittmHumidifier.prototype.setActive = function(value, callback) {

  this.tuyaDebug('Current Powerstate: ' + this.powerState + ' Changing to: ' + value );

  if(this.deviceEnabled === true) {
	 /** 
    var dpsTmp = {'1' : true }
    
    if (value === 1){
		dpsTmp = {'1' : true}
	} else {
		dpsTmp = {'1' : false}
	}
	*/
	var dpsTmp = {
		'1' : true,
		'6' : this.fanmode,
		'11' : true,
		'12' : this.unknown,
		'101' : this.water_shortage
	};
	
	this.tuyaDebug(dpsTmp);
	
	//this.OittmHumidifier.set(this, {id: this.devId, 'dps': 1, set: true}).then(() => console.log('device was changed'))
	
    // TODO: Skip if the light is already on...
    
    
    this.OittmHumidifier.set(this, {'devId': this.devId, 'dps' : dpsTmp}).then(result => {
        if(result) {
          this.tuyaDebug('TUYA SET HUMIDIFIER POWER ' + this.debugPrefix);
          this.tuyaDebug('Setting ' + this.name + ' dps: ' + '1' + ' device to: ' + value );
          this.tuyaDebug('Setting ' + this.name + ' Result: ' + result);

          this.tuyaDebug('END TUYA SET HUMIDIFIER POWER ' + this.debugPrefix);
          this.powerState = true;
          callback();
        }
      }).catch(error => {
          this.tuyaDebug('BEGIN TUYA GET HUMIDIFIER STATUS ERROR ' + this.debugPrefix);
          this.tuyaDebug('Got Tuya HUMIDIFIER device ERROR for ' + this.name);
          this.tuyaDebug(error);
          this.tuyaDebug('END TUYA GET HUMIDIFIER POWER STATUS ERROR ' + this.debugPrefix);
          if(!this.debugging) {
            this.log.warn(error.message);
          }
          callback(error);
    });
  } else {
    this.log.warn('Device is disabled... Bailing out...');
    return callback('Disabled');
  }
}


// MARK: - Polling

OittmHumidifier.prototype.devicePolling = function() {

  this.log('Polling at interval... ' + this.refreshInterval + ' seconds');

  this.getCurrentHumidifierDehumidifierState(function(error, result) {
    if(error) {
      this.tuyaDebug('Error Humidifier status');
    } else {
      // this.tuyaDebug(JSON.stringify(result, null, 8));
      // this.tuyaDebug(JSON.stringify(this, null, 8));
    }
      // this.tuyaDebug(JSON.stringify(this, null, 8));
  }.bind(this));

  if(this.config.superDebug) {
    this.tuyaDebug(JSON.stringify(this, null, 8));
  }
};


// ROTATION SPEED

OittmHumidifier.prototype.getRotationSpeed = function(callback) {

	var fanmode = this.fanmode;

 if(this.deviceEnabled === true) {	
	 this.OittmHumidifier.get(this, {schema: true}).then(status => {
		
	    if(status.dps['6'] !== undefined) {
		  fanmode = status.dps['6'];
        this.fanmode = status.dps['6'];
      }
		
		
      this.tuyaDebug('TUYA GET HUMIDIFIER FAN MODE for ' + this.name + ' dps: 6'  + this.debugPrefix);
      this.tuyaDebug('Returned status: ' + fanmode);
      this.tuyaDebug('END TUYA GET HUMIDIFER FAN MODE ' + this.debugPrefix);		
		callback(null, fanmode);
		
   }).catch(error => {
        this.tuyaDebug('TUYA GET FAN MODE ERROR for ' + this.name + ' dps: 6');
        this.tuyaDebug(error.message);
        this.tuyaDebug('END TUYA GET FAN MODE ERROR ' + this.debugPrefix);
        return callback(error);
    });
  } else {
    this.log.warn('Device is disabled... Bailing out...');
    return callback('Device is disabled...');
  }
}

OittmHumidifier.prototype.setRotationSpeed = function(value, callback) {
	 this.tuyaDebug('Current fanmode: ' + this.fanmode + ' Changing to: ' + value );
		var dpsTmp2 = {
			'1' : true,
			'6' : value,
			'11': true,
			'12': 0,
			'101' : false
			 };
  
  
  this.OittmHumidifier.set(this, {'id': this.devId, 'dps' : dpsTmp2}).then(result => {
        if(result) {
          this.tuyaDebug('TUYA SET FAN MODE ' + this.debugPrefix);
          this.tuyaDebug('Setting ' + this.name + ' dps: ' + '6' + ' device to: ' + value );
          this.tuyaDebug('Setting ' + this.name + ' Result: ' + result);

          this.tuyaDebug('END TUYA SET FAN MODE ' + this.debugPrefix);
          this.fanmode = value;
          
          callback();
        }
      }).catch(error => {
          this.tuyaDebug('BEGIN TUYA GET FAN MODE ERROR ' + this.debugPrefix);
          this.tuyaDebug('Got Tuya HUMIDIFIER device ERROR for ' + this.name);
          this.tuyaDebug(error);
          this.tuyaDebug('END TUYA GET HUMIDIFIER FAN MODE ERROR ' + this.debugPrefix);
          if(!this.debugging) {
            this.log.warn(error.message);
          }
          callback(error);
    });

  }
	

OittmHumidifier.prototype.tuyaDebug = function(args) {
  if(this.debugging === true) {
    this.log.debug(this.debugPrefix, args);
  }
};

OittmHumidifier.prototype.identify = function (callback) {
  this.tuyaDebug(this.name + ' was identified.');
  callback();
};

OittmHumidifier.prototype.getServices = function() {
  this.devicePolling();

  // Setup the HAP services
  informationService = new Service.AccessoryInformation();

  informationService
        .setCharacteristic(Characteristic.Manufacturer, 'Oittm')
        .setCharacteristic(Characteristic.Model, 'SH01')
        .setCharacteristic(Characteristic.SerialNumber, this.devId);

  var humidifierService = new Service.HumidifierDehumidifier(this.name);
  var currentHumidifierDehumidifierStateCharacteristic = humidifierService.getCharacteristic(Characteristic.CurrentHumidifierDehumidifierState);
  var activeCharacteristic = humidifierService.getCharacteristic(Characteristic.Active);
  var targetHumidifierDehumidifierStateCharacteristic = humidifierService.getCharacteristic(Characteristic.TargetHumidifierDehumidifierState);
  var rotationSpeedCharacteristic = humidifierService.getCharacteristic(Characteristic.RotationSpeed);
  
	//power (active) - require
  humidifierService.getCharacteristic(Characteristic.Active)
        .on('get', this.getActive.bind(this))
        .on('set', this.setActive.bind(this));

	//  Current State - required

	
  humidifierService.getCharacteristic(Characteristic.CurrentHumidifierDehumidifierState)
		.on('get', this.getCurrentHumidifierDehumidifierState.bind(this));

    // Target State - required
    targetHumidifierDehumidifierStateCharacteristic.setValue(Characteristic.TargetHumidifierDehumidifierState.HUMIDIFIER);

	//Rotation speed - optional characteristic
	
  rotationSpeedCharacteristic.setProps({
      minValue: 1,
      maxValue: 3,
      minStep: 1,
    });
	
  humidifierService.getCharacteristic(Characteristic.RotationSpeed)
		.on('get', this.getRotationSpeed.bind(this))
		.on('set', this.setRotationSpeed.bind(this));

    return  [informationService, humidifierService];
};

