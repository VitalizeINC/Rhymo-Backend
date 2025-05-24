
import database from './database.js'
import session from './session.js'
import layout from './layout.js'
import service from './service.js'

export default {
    layout,
    service,
    session,
    database,
    port : process.env.APPLICATION_PORT,
    jwt:{
        secret_key : 'V6v7l6c5f!@#$%^&dkzgmjlakgmjalgmja'
    },
    debug:true
}