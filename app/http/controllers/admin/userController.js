const controller = require('app/http/controllers/controller');
const User = require('app/models/user');
const Role = require('app/models/role');

class userController extends controller {
    async index(req , res , next) {
        try {
            let page = req.query.page || 1;
            let users = await User.paginate({} , { page , sort : { createdAt : 1 } , limit : 20 });

            res.render('admin/users/index',  { title : 'کاربران' , users });
        } catch (err) {
            next(err);
        }
    }

    async create(req , res) {
        res.render('admin/users/create');        
    }
    async toggleadmin(req,res,next){
        try {
            let user = await User.findById(req.params.id)
            user.set({admin : ! user.admin})
            await user.save()
            return this.back(req,res)

        } catch (err) {
            next(err)
        }
    }
    async store(req , res , next) {
        try {
            let status = await this.validationData(req);
            if(! status) return this.back(req,res);
            let { name , phoneNumber , email , password } = req.body;
            let user = await User.findOne({phoneNumber})
            if(user){
                req.flash('errors' , 'کاربر با این شماره قبلا ثبت نام کرده')
                return this.back(req,res)
            } 
            let newUser = new User({ 
                name,
                phoneNumber,
                email,
                password
             });

            await newUser.save();

            return res.redirect('/admin/users');  
        } catch(err) {
            next(err);
        }
    }

    async edit(req, res ,next) {
        try {
            this.isMongoId(req.params.id);

            let category = await Category.findById(req.params.id);
            let categories = await Category.find({ parent : null });
            if( ! category ) this.error('چنین دسته ای وجود ندارد' , 404);


            return res.render('admin/categories/edit' , { category , categories });
        } catch (err) {
            next(err);
        }
    }

    async update(req, res , next) {
        try {
            let status = await this.validationData(req);
            if(! status) return this.back(req,res);

            let { name , parent } = req.body;
            
            await Category.findByIdAndUpdate(req.params.id , { $set : { 
                name,
                slug : this.slug(name),
                parent : parent !== 'none' ? parent : null
             }})

            return res.redirect('/admin/categories');
        } catch(err) {
            next(err);
        }
    }

    async destroy(req , res , next) {
        try {
            this.isMongoId(req.params.id);

            let user = await User.findById(req.params.id);
            if( ! user ) this.error('چنین کاربری وجود ندارد' , 404);

            // delete category
            user.remove();

            return res.redirect('/admin/users');
        } catch (err) {
            next(err);
        }
    }
    
    async addRole(req , res ,next) {
        try {
            this.isMongoId(req.params.id);
            
            let user = await User.findById(req.params.id);
            console.log(user.roles)
            let roles = await Role.find({});
            if( ! user ) this.error('چنین کاربری وجود ندارد' , 404);
        
            res.render('admin/users/addrole', { user , roles });            
        } catch (err) {
            next(err);
        }
    }

    async storeRoleForUser(req , res , next) {
        try {
            this.isMongoId(req.params.id);

            let user = await User.findById(req.params.id);
            if( ! user ) this.error('چنین کاربری وجود ندارد' , 404);

            user.set({ roles : req.body.roles });
            await user.save();

            res.redirect('/admin/users');
        } catch (err) {
            next(err);
        }
    }


}

module.exports = new userController();