// --------------------------  通用方法  ---------------------------
//扩展js string endwith,startwith方法
String.prototype.endWith = function (str) {
    if (str == null || str == "" || this.length == 0 || str.length > this.length)
        return false;
    if (this.substring(this.length - str.length) == str)
        return true;
    else
        return false;
}

String.prototype.startWith = function (str) {
    if (str == null || str == "" || this.length == 0 || str.length > this.length)
        return false;
    if (this.substr(0, str.length) == str)
        return true;
    else
        return false;
}

//UTF-16转UTF-8
function utf16ToUtf8(s) {
    if (!s) {
        return;
    }
    var i, code, ret = [],
        len = s.length;
    for (i = 0; i < len; i++) {
        code = s.charCodeAt(i);
        if (code > 0x0 && code <= 0x7f) {
            //单字节
            //UTF-16 0000 - 007F
            //UTF-8  0xxxxxxx
            ret.push(s.charAt(i));
        } else if (code >= 0x80 && code <= 0x7ff) {
            //双字节
            //UTF-16 0080 - 07FF
            //UTF-8  110xxxxx 10xxxxxx
            ret.push(
                //110xxxxx
                String.fromCharCode(0xc0 | ((code >> 6) & 0x1f)),
                //10xxxxxx
                String.fromCharCode(0x80 | (code & 0x3f))
            );
        } else if (code >= 0x800 && code <= 0xffff) {
            //三字节
            //UTF-16 0800 - FFFF
            //UTF-8  1110xxxx 10xxxxxx 10xxxxxx
            ret.push(
                //1110xxxx
                String.fromCharCode(0xe0 | ((code >> 12) & 0xf)),
                //10xxxxxx
                String.fromCharCode(0x80 | ((code >> 6) & 0x3f)),
                //10xxxxxx
                String.fromCharCode(0x80 | (code & 0x3f))
            );
        }
    }
    return ret.join('');
}

//若要显示:当前日期加时间(如:200906121200)
function currentTime() {
    var now = new Date();

    var year = now.getFullYear(); //年
    var month = now.getMonth() + 1; //月
    var day = now.getDate(); //日

    var hh = now.getHours(); //时
    var mm = now.getMinutes(); //分

    var clock = year + "";

    if (month < 10)
        clock += "0";

    clock += month + "";

    if (day < 10)
        clock += "0";

    clock += day + "";

    if (hh < 10)
        clock += "0";

    clock += hh + "";
    if (mm < 10) clock += '0';
    clock += mm;
    return (clock);
}

/**
 * 判断文件个数是否为0，若为0则关闭
 * @param {*} name 
 */
function closeEtIfNoDocument() {
    var etApp = wps.EtApplication();
    var docs = etApp.Workbooks;
    if (docs && docs.Count == 0) {
        etApp.Quit();
    }
}

function activeTab() {
    console.log("activeTab:" + Date());
    wps.ribbonUI.ActivateTab('WPSWorkExtTab');
}

function showOATab() {
    wps.PluginStorage.setItem("ShowOATabDocActive", pCheckIfOADoc()); //根据文件是否为OA文件来显示OA菜单
    wps.ribbonUI.Invalidate(); // 刷新Ribbon自定义按钮的状态
}

function pGetParamName(data, attr) {
    var start = data.indexOf(attr);
    data = data.substring(start + attr.length);
    return data;
}

/**
 * 从requst中获取文件名（确保请求中有filename这个参数）
 * @param {*} request 
 * @param {*} url 
 */
 function pGetFileName(request, url) {
    var disposition = request.getResponseHeader("Content-Disposition");
    var filename = "";
    if (disposition) {
        var matchs = pGetParamName(disposition, "fileName=");
        if (matchs) {
            filename = decodeURIComponent(matchs);
        } else {
            filename = "petro" + Date.getTime();
        }
    } else {
        filename = url.substring(url.lastIndexOf("/") + 1);
        filename=filename.split("?")[0]
    }
    return filename;
}

function StringToUint8Array(string) {
    var binLen, buffer, chars, i, _i;
    binLen = string.length;
    buffer = new ArrayBuffer(binLen);
    chars = new Uint8Array(buffer);
    for (var i = 0; i < binLen; ++i) {
        chars[i] = String.prototype.charCodeAt.call(string, i);
    }
    return buffer;
}

function DownloadFile(url, params, callback) {
    // 需要根据业务实现一套
    console.log("下载DownloadFile，WPS下载文件到本地打开")
    console.log('DownloadFile:myinfo', Myinfo)
    var mystr = Myinfo.cookieInfo;
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            var fileName = pGetFileName(xhr, url)
            if(params['extInfo'].hasOwnProperty('printFormId')){
                //打印处理单、会签单，对稿纸做区分
                let curTime = new Date().getTime();
                const timestamp = curTime.toString();
                var path = wps.Env.GetTempPath() + "/" + timestamp + fileName
            } else {
            //落地打开模式下，WPS会将文件下载到本地的临时目录，在关闭后会进行清理
                var path = wps.Env.GetTempPath() + "/" + fileName
            }
            var reader = new FileReader();
            reader.onload = function () {
                console.log('DownloadFile:返回的数据类型', typeof reader.result)
                console.log('wps.FileSystem.writeAsBinaryString(path, reader.result)', wps.FileSystem.writeAsBinaryString(path, reader.result))
                var printSuccessFlag = wps.FileSystem.writeAsBinaryString(path, reader.result)
                if (!printSuccessFlag) {
                    var returnData = JSON.parse(reader.result)
                    // if (reader.result.code != 1) {
                    //     wps.confirm(reader.result.message)
                    // }
                    console.log('返回的数据reader.result.code', returnData)
                    {
                        var info = 
                        {
                            code : returnData.code,
                            message : '22222222222222222222返回的数据',
                            type: 'downloadPaperFail'
                        }
                        wps.OAAssist.WebNotify(JSON.stringify(info).replace(/\"/g,"'"), true);
                    }
                } else {
                    wps.FileSystem.writeAsBinaryString(path, reader.result);
                    callback(path); 
                } 
            };
            try
            {
                //console.log("121212121212166666666666666666666666", JSON.stringify(xhr.response))
                reader.readAsBinaryString(xhr.response);
            }
            catch(err)
            {
                var info = 
                {
                    code : 0,
                    message : "模板不存在！"
                }
                wps.OAAssist.WebNotify(JSON.stringify(info).replace(/\"/g,"'"));
            }
        }
    }
    xhr.open('GET', url);
    xhr.withCredentials=true;
    xhr.responseType = 'blob';
    xhr.setRequestHeader("eoffice-Token", Myinfo['eoffice-Token']); // eoffice-Token: e3bcd4b9a244424d9919c3496bc4edb3
    // xhr.setRequestHeader("eoffice-Token", '858413d56c884feb9992450e424c82b3');
    xhr.setRequestHeader("X-Custom-Header",mystr);
    xhr.send();
}

function UploadFile(strFileName, strPath, uploadPath, strFieldName, OnSuccess, OnFail) {
    var mystr = Myinfo.cookieInfo;
    document.cookie=mystr;
    var xhr = new XMLHttpRequest();
    xhr.open('POST', uploadPath);
    xhr.withCredentials=true;
    function KFormData() {
        this.fake = true;
        this.boundary = "--------FormData" + Math.random();
        this._fields = [];
    }
    KFormData.prototype.append = function (key, value) {
        this._fields.push([key, value]);
    }
    KFormData.prototype.toString = function () {
        var boundary = this.boundary;
        var body = "";
        this._fields.forEach(function (field) {
            body += "--" + boundary + "\r\n";
            if (field[1].name) {
                var file = field[1];
                body += "Content-Disposition: form-data; name=\"" + field[0] + "\"; filename=\"" + file.name + "\"\r\n";
                body += "Content-Type: " + file.type + "\r\n\r\n";
                body += file.getAsBinary() + "\r\n";
            } else {
                body += "Content-Disposition: form-data; name=\"" + field[0] + "\";\r\n\r\n";
                body += field[1] + "\r\n";
            }
        });
        body += "--" + boundary + "--";
        return body;
    }
    var fileData = wps.FileSystem.readAsBinaryString(strPath);
    var data = new KFormData();

    if (strFieldName == "" || typeof strFieldName == "undefined"){
        strFieldName = "";
    }
    data.append(strFieldName, {
        name: utf16ToUtf8(strFileName),
        type: "application/octet-stream",
        getAsBinary: function () {
            return fileData;
        }
    });
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4) {
            if (xhr.status == 200)
                OnSuccess(xhr.response)
            else
                OnFail(xhr.response);
        }
    };
    xhr.setRequestHeader("Cache-Control", "no-cache");
    xhr.setRequestHeader("eoffice-Token", Myinfo['eoffice-Token']); // eoffice-Token: e3bcd4b9a244424d9919c3496bc4edb3
    xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
    xhr.setRequestHeader("X-Custom-Header",mystr);
    if (data.fake) {
        xhr.setRequestHeader("Content-Type", "multipart/form-data; boundary=" + data.boundary);
        var arr = StringToUint8Array(data.toString());
        xhr.send(arr);
    } else {
        xhr.send(data);
    }
}