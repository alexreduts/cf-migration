/**
 * This is the file where the backup gets deleted.
 *
 */

var environment = require('./environment');
var AWS = require('ibm-cos-sdk');
var cos;


//gets the list of the buckets in the COS, if they are created before a specific time it the bucket gets checked for entrys
exports.deleteBackup = function () {

    //credentials
    if (environment.VCAP_SERVICES["cloud-object-storage"]) {

        console.log("Using Bound Object Storage");

        var vcapServices = environment.VCAP_SERVICES["cloud-object-storage"];
        credentials = vcapServices[0].credentials;

        config = {
            apiKeyId: credentials.apikey,
            serviceInstanceId: credentials.resource_instance_id
        };

    //if remote - Pull in values from manifest
    } else {
        console.log("Using Remote Cloud Object Storage");
        config = {
            apiKeyId: environment.cos_api_key,
            serviceInstanceId: environment.cos_resource_instance_id
        };
    }

    config.endpoint = environment.cos_endpoint_url;
    config.ibmAuthEndpoint = 'https://iam.ng.bluemix.net/oidc/token';

    //Authenticate
    cos = new AWS.S3(config);
    //

    //fil array with databasenames from env. variable
    var dbNames = [];

    if (process.env.database_names.indexOf(",") > -1) {
        var db_names = process.env.database_names.split(",");
        for (var db of db_names) {
            dbNames.push(db.trim());
        }
    } else {
        dbNames.push(process.env.database_names);
    }

    //console.log(dbNames)

    console.log('Retrieving list of buckets');
    return cos.listBuckets()
        .promise()
        .then((data) => {
            if (data.Buckets != null) {
                for (var i = 0; i < data.Buckets.length; i++) {
                    var bucketNameWithoutDate = data.Buckets[i].Name.substring(0, data.Buckets[i].Name.length - 8);
                    //console.log(bucketNameWithoutDate);

                    for (var y = 0; y < dbNames.length; y++) {
                        if (bucketNameWithoutDate == "cloudant-db-" + dbNames[y]) {

                            var bucketNameSplitted = data.Buckets[i].Name.split('-');
                            var creationDateString = bucketNameSplitted[bucketNameSplitted.length - 2] + "-" + bucketNameSplitted[bucketNameSplitted.length - 1];
                            var creationDate = new Date(creationDateString);

                            var dateToday = new Date();

                            //while comparing add 1 to month, because the mont count starts at 0

                            if (dateToday.getFullYear() - creationDate.getFullYear() != 0) {
                                if ((creationDate.getMonth() + 1) == 12 && (dateToday.getMonth() + 1) == 1) {
                                    console.log("Bucket: " + data.Buckets[i].Name + " not older then 2 months");
                                } else {
                                    // console.log("Would delete bucket " + data.Buckets[i].Name);
                                    getBucketContents(data.Buckets[i].Name);
                                }
                            } else if ((dateToday.getMonth() + 1) - (creationDate.getMonth() + 1) >= 2) {
                                // console.log("Would delete Bucket " + data.Buckets[i].Name);
                                getBucketContents(data.Buckets[i].Name);
                            } else {
                                console.log("Bucket: " + data.Buckets[i].Name + " not older then 2 months");
                            }
                        }

                    }
                }


            }
        })
        .catch((e) => {
            console.error(`ERROR: ${e.code} - ${e.message}\n`);
        });
};

//deletes the bucket if empty, if not an object of the entrys will be created and deleted in the next function
function getBucketContents (bucketName) {
    console.log(`Retrieving bucket contents from: ${bucketName}`);
    return cos.listObjects(
        { Bucket: bucketName },
    ).promise()
        .then((data) => {
            if (data != null && data.Contents != null) {

                var keysObject = { "Objects": [] };

                if (data.Contents.length != 0) {
                    for (var i = 0; i < data.Contents.length; i++) {

                        console.log(data.Contents[i].Key)
                        var keyObject = { Key: data.Contents[i].Key };

                        keysObject.Objects.push(keyObject);
                    }

                    console.log(keysObject);
                    deleteItems(bucketName, keysObject);

                } else {
                    deleteBucket(bucketName);
                }
            }
        })
        .catch((e) => {
            console.error(`ERROR: ${e.code} - ${e.message}\n`);
        });
};

//deletes the entrys of a bucket and removes the bucket afterwards
function deleteItems (bucketName, deleteRequest) {
    return cos.deleteObjects({
        Bucket: bucketName,
        Delete: deleteRequest
    }).promise()
        .then((data) => {
            console.log(`Deleted items for ${bucketName}`);
            console.log(data.Deleted);
            deleteBucket(bucketName);
        })
        .catch((e) => {
            console.log(`ERROR: ${e.code} - ${e.message}\n`);
        });
}


//deltes a specific bucket
function deleteBucket(bucketName) {
    console.log(`Deleting bucket: ${bucketName}`);
    return cos.deleteBucket({
        Bucket: bucketName
    }).promise()
        .then(() => {
            console.log(`Bucket: ${bucketName} deleted!`);
        })
        .catch((e) => {
            console.error(`ERROR: ${e.code} - ${e.message}\n`);
        });
}