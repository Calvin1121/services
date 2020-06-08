const app = getApp();
var timer;
Page({
    data: {
        function: false,
        emoji: false,
        comment: '',
        focus: false,
        cursor: 0,
        _keyboardShow: false,
        emojiSource: 'https://res.wx.qq.com/wxdoc/dist/assets/img/emoji-sprite.b5bd1fe0.png',
        parsedComment: [],
        functions: [{
                icon: 'icon-fatupian',
                flag: 'album',
                label: '照片'
            },
            {
                icon: 'icon-paishe',
                flag: 'camera',
                label: '拍摄'
            },
        ],
        keyboardHeight: 0,
        isIPX: app.globalData.isIPX,
        scrollTop: 0,
        chats: [],
        avatar: null,
        uid: null
    },

    onLoad() {
        const emojiInstance = this.selectComponent('.mp-emoji')
        this.emojiNames = emojiInstance.getEmojiNames()
        this.parseEmoji = emojiInstance.parseEmoji;
        this.initSubscribe()
    },
    onShow() {
        this.getMember();
        this.getBttm()
    },
    getMember() {
        if (app.check()) {
            let userinfo = wx.getStorageSync('userinfo');
            this.setData({
                uid: userinfo.userId
            })
            if (!this.data.avatar)
                app.get("/weapp/user/share", res => {
                    if (res.success) {
                        let { avatar } = res.data;
                        this.setData({ avatar })
                    }
                })
        } else {
            wx.navigateTo({
                url: '/pages/login/login'
            })
        }
    },
    initSubscribe() {
        app.goEasy.subscribe({
            channel: "my_channel", //替换为您自己的channel
            onMessage: (message) => {
                let { content } = message, { chats } = this.data;
                chats.push((JSON.parse(content)))
                this.setData({ chats })
                this.getBttm()
            }
        });
    },
    getBttm() {
        wx.createSelectorQuery().select('#reply').boundingClientRect(rect => {
            if (rect) {
                this.setData({
                    replyHeight: rect.height
                })
            }
        }).select('#bttm').boundingClientRect(rect => {
            if (rect) {
                this.setData({
                    scrollTop: rect.bottom + 6000
                })
            }
        }).exec()
    },
    toggleInput() {
        this.hideAllPanel();
        clearTimeout(timer)
        timer = setTimeout(() => {
            this.setData({
                _keyboardShow: true,
                focus: true
            })
        }, 50)
    },
    onkeyboardHeightChange(e) {
        const { height } = e.detail
        this.setData({
            keyboardHeight: height
        })
    },

    hideAllPanel() {
        this.setData({
            function: false,
            emoji: false
        })
        this.getBttm()
    },
    toggleFunction(e) {
        let { flag } = app.getDataset(e);
        this.setData({
            [`${flag.match(/emoji/gi)?'function':'emoji'}`]: false,
            focus: false,
            _keyboardShow: false,
            [`${flag}`]: this.data._keyboardShow || !this.data[flag]
        })
        this.getBttm()
    },
    tapFunction(e) {
        let { item } = app.getDataset(e), { avatar, uid } = this.data;
        wx.chooseImage({
            count: 9,
            sizeType: ['compressed'],
            sourceType: [item.flag],
            success: res => {
                const { tempFilePaths } = res, temp = [];
                for (let k = 0; k < tempFilePaths.length; k++) {
                    let parsedComment = [{
                        type: 3,
                        content: tempFilePaths[k]
                    }]
                    const msg = JSON.stringify({ parsedComment, avatar, uid })
                    this.publishMsg(msg)
                };
            }
        })
    },
    onFocus() {
        this.setData({
            _keyboardShow: true
        })
        this.hideAllPanel()
    },
    onBlur(e) {
        this.setData({
            _keyboardShow: false,
            cursor: e.detail.cursor || 0
        })
    },
    onInput(e) {
        const value = e.detail.value
        this.setData({ comment: value })
    },
    insertEmoji(evt) {
        const emotionName = evt.detail.emotionName
        const { cursor, comment } = this.data
        const newComment = comment.slice(0, cursor) + emotionName + comment.slice(cursor)
        this.setData({
            comment: newComment,
            cursor: cursor + emotionName.length
        })
    },
    onsend() {
        const { comment, avatar, uid } = this.data
        const parsedComment = this.parseEmoji(this.data.comment)
        let flag = 0;
        for (let k = 0; k < parsedComment.length; k++) {
            if (parsedComment[k].content.trim()) {
                flag++;
            }
        }
        if (!flag) {
            wx.showModal({
                content: '不能发送空白消息',
                showCancel: false
            });
            return
        }
        const msg = JSON.stringify({ parsedComment, avatar, uid })
        this.setData({
            comment: ''
        })
        this.publishMsg(msg)
    },
    deleteEmoji: function() {
        const pos = this.data.cursor
        const comment = this.data.comment
        let result = '',
            cursor = 0

        let emojiLen = 6
        let startPos = pos - emojiLen
        if (startPos < 0) {
            startPos = 0
            emojiLen = pos
        }
        const str = comment.slice(startPos, pos)
        const matchs = str.match(/\[([\u4e00-\u9fa5\w]+)\]$/g)
        // 删除表情
        if (matchs) {
            const rawName = matchs[0]
            const left = emojiLen - rawName.length
            if (this.emojiNames.indexOf(rawName) >= 0) {
                const replace = str.replace(rawName, '')
                result = comment.slice(0, startPos) + replace + comment.slice(pos)
                cursor = startPos + left
            }
            // 删除字符
        } else {
            let endPos = pos - 1
            if (endPos < 0) endPos = 0
            const prefix = comment.slice(0, endPos)
            const suffix = comment.slice(pos)
            result = prefix + suffix
            cursor = endPos
        }
        this.setData({
            comment: result,
            cursor: cursor
        })
    },
    publishMsg(message) {
        app.goEasy.publish({
            channel: "my_channel",
            message: message,
            onFailed: error => {
                wx.showToast({
                    title: `发送失败:${error.content}`,
                    icon: 'none'
                })
            }
        })
    },
    preview(e) {
        let { current } = app.getDataset(e), { chats } = this.data,
            urls = [];
        for (let k = 0; k < chats.length; k++) {
            if (chats[k].parsedComment) {
                let temp = chats[k].parsedComment.filter(v => v.type == 3).map(v => v.content);
                urls = [...urls, ...temp]
            }
        }
        wx.previewImage({
            current,
            urls
        })
    }
})