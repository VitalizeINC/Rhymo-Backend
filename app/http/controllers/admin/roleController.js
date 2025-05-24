const controller = require('app/http/controllers/controller');
const Role = require('app/models/role');
const Permission = require('app/models/permission');

class roleController extends controller {
    async index(req , res , next) {
        try {
            let page = req.query.page || 1;
            let roles = await Role.paginate({} , { page , sort : { createdAt : 1 } , limit : 20 });

            res.render('admin/roles/index',  { title : 'کاربران' , roles });
        } catch (err) {
            next(err);
        }
    }

    async create(req , res) {
        let permissions = await Permission.find({})
        res.render('admin/roles/create' , {permissions});        
    }
   
    async store(req , res , next) {
        try {
            let status = await this.validationData(req);
            if(! status) return this.back(req,res);
            let { name , label , permissions } = req.body;
            let role = await Role.findOne({name})
            if(role){
                req.flash('errors' , 'نقش با این اسم قبلا ثبت شده')
                return this.back(req,res)
            } 
            let newRole = new Role({ 
                name,
                label,
                permissions
             });

            await newRole.save();

            return res.redirect('/admin/users/roles');  
        } catch(err) {
            next(err);
        }
    }

    async edit(req, res ,next) {
        try {
            this.isMongoId(req.params.id);

            let role = await Role.findById(req.params.id);
            if( ! role ) this.error('چنین اجازه دسترسی ای وجود ندارد' , 404);
            let permissions = await Permission.find({})

            return res.render('admin/roles/edit' , { role , permissions });
        } catch (err) {
            next(err);
        }
    }

    async update(req, res , next) {
        try {
            let status = await this.validationData(req);
            if(! status) return this.back(req,res);

            let { name , label , permissions } = req.body;
            await Role.findByIdAndUpdate(req.params.id , { $set : { 
                name,
                label,
                permissions
             }})

            return res.redirect('/admin/users/roles');
        } catch(err) {
            next(err);
        }
    }

    async destroy(req , res , next) {
        try {
            this.isMongoId(req.params.id);

            let role = await Role.findById(req.params.id);
            if( ! role ) this.error('چنین اجازه ای وجود ندارد' , 404);

            // delete role
            role.remove();

            return res.redirect('/admin/users/roles');
        } catch (err) {
            next(err);
        }
    }

}

module.exports = new roleController();