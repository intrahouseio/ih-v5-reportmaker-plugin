const util = require('util');
const plugin = require('ih-plugin-api')();

const app = require('./app');


(async () => {
  plugin.log('Reportmaker plugin has started.', 0);
  try {

    plugin.params.data = await plugin.params.get();
 
    plugin.log('Received params ' + JSON.stringify(plugin.params.data));
    // if (!plugin.params.agentPath) throw { message: 'No agentPath!' };
    
    app(plugin);
  } catch (e) {
    console.log('ERROR: ' + util.inspect(e));
    plugin.log('ERROR: ' + util.inspect(e));
    plugin.exit(1);
  }
})();
