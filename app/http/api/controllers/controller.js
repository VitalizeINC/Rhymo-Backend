import autoBind from 'auto-bind';


export default class controller {
    constructor(){  
        autoBind(this)
    }
    failed(msg , res , statusCode = 500 ){
        res.json({
            data : msg,
            status : 'error'
        })
    }
    
}