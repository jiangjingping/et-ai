import Util from './js/util.js'
import aiService from './js/aiService.js'
import aiChatManager from './js/aiChatManager.js'

//这个函数在整个wps加载项中是第一个执行的
function OnAddinLoad(ribbonUI){
    if (typeof (window.Application.ribbonUI) != "object"){
		window.Application.ribbonUI = ribbonUI
    }

    if (typeof (window.Application.Enum) != "object") { // 如果没有内置枚举值
        window.Application.Enum = Util.WPS_Enum
    }



    // 初始化AI对话管理器
    aiChatManager.initialize()

    return true
}

function OnAction(control) {
    const eleId = control.Id
    switch (eleId) {
        case "btnAIChat":
            aiChatManager.toggleChatPanel()
            break
        default:
            console.log("未知按钮:", eleId)
            break
    }
    return true
}

function GetImage(control) {
    const eleId = control.Id
    switch (eleId) {
        case "btnAIChat":
            return "images/newFromTemp.svg"
        default:
            return "images/newFromTemp.svg"
    }
}

function OnGetEnabled(control) {
    return true
}

function OnGetVisible(control){
    return true
}

function OnGetLabel(control){
    return ""
}

//这些函数是给wps客户端调用的
export default {
    OnAddinLoad,
    OnAction,
    GetImage,
    OnGetEnabled,
    OnGetVisible,
    OnGetLabel
};
