require('dotenv').load();
var Vacation = require('../models/vacation');

exports.index = function(req, res) {
    Vacation.find({}, function(err, vacation) {
        res.json(vacation);
    })
};

exports.create = function(req, res) {
    Vacation.create(req.body, function(err, v) {
        if (v) {
            res.json({vacation: v});
        } else {
            var errs = [];
            if (!err.errors) {
                errs.push(err.message);
            }
            for (var key in err.errors) {
                if (err.errors.hasOwnProperty(key)) {
                    errs.push(err.errors[key].message);
                }
            }
            res.json({errors: errs});
        }
    });
};

exports.delete = function(req, res) {
    Vacation.findOneAndRemove({_id: req.params.id}, function(err, v) {
        if (v) {
            v.remove();
            res.json({message: "Vacation removed"});
        } else {
            res.json({errors: ["something bad happened."]});
        }
    });
};