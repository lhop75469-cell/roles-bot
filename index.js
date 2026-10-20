const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    PermissionsBitField 
} = require('discord.js');
const fs = require('fs');

const PREFIX = '!';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ]
});

// دالة تحميل وحفظ البيانات في data.json
function loadData() {
    if (!fs.existsSync('./data.json')) {
        fs.writeFileSync('./data.json', JSON.stringify({ roles: [] }));
    }
    return JSON.parse(fs.readFileSync('./data.json'));
}

function saveData(data) {
    fs.writeFileSync('./data.json', JSON.stringify(data, null, 2));
}

client.on('ready', () => {
    console.log(`✅ تم تشغيل البوت بنجاح باسم: ${client.user.tag}`);
});

// معالجة الرسائل والأوامر العادية
client.on('messageCreate', async message => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // التأكد من أن المستخدم عنده صلاحية إدارة الرتب
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) return;

    const data = loadData();

    // 1️⃣ أمر إضافة رتبة: !addrole @Role الوصف الأيموجي
    if (command === 'addrole' || command === 'إضافة-رتبة') {
        const role = message.mentions.roles.first();
        if (!role) {
            return message.reply('❌ يرجى تحديد الرتبة! مثال:\n`!addrole @VIP رتبة المميزين ⭐`');
        }

        const remainingArgs = args.slice(1);
        if (remainingArgs.length === 0) {
            return message.reply('❌ يرجى كتابة وصف للرتبة!');
        }

        const emoji = remainingArgs[remainingArgs.length - 1].match(/\p{Extended_Pictographic}/u) ? remainingArgs.pop() : '🔹';
        const description = remainingArgs.join(' ') || 'رتبة داخل السيرفر';

        if (data.roles.some(r => r.id === role.id)) {
            return message.reply('❌ هذه الرتبة مضافة في القائمة بالفعل!');
        }

        data.roles.push({
            id: role.id,
            label: role.name,
            description: description,
            emoji: emoji
        });

        saveData(data);
        return message.reply(`✅ تم إضافة الرتبة **${role.name}** بنجاح!`);
    }

    // 2️⃣ أمر إزالة رتبة: !removerole @Role
    if (command === 'removerole' || command === 'حذف-رتبة') {
        const role = message.mentions.roles.first();
        if (!role) {
            return message.reply('❌ يرجى تحديد الرتبة المراد إزالتها! مثال:\n`!removerole @VIP`');
        }

        if (!data.roles.some(r => r.id === role.id)) {
            return message.reply('❌ هذه الرتبة غير موجودة في القائمة الأصل!');
        }

        data.roles = data.roles.filter(r => r.id !== role.id);
        saveData(data);
        return message.reply(`✅ تم إزالة الرتبة **${role.name}** من المنيو!`);
    }

    // 3️⃣ أمر إرسال المنيو: !sendmenu
    if (command === 'sendmenu' || command === 'المنيو') {
        if (data.roles.length === 0) {
            return message.reply('❌ لا توجد أي رتب مضافة حالياً! أضف رتبة أولاً باستعمال أمر `!addrole`.');
        }

        const embed = new EmbedBuilder()
            .setTitle('📌 قائمة اختيار الرتب')
            .setDescription('اختر الرتب التي تريد الحصول عليها من القائمة المنسدلة أدناه.')
            .setColor('#2b2d31')
            .setFooter({ text: 'يمكنك إزالة الرتبة بإلغاء تحديدها من القائمة' });

        const options = data.roles.map(r => ({
            label: r.label,
            description: r.description,
            value: r.id,
            emoji: r.emoji
        }));

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('roles_select_menu')
                .setPlaceholder('اضغط هنا لاختيار الرتب...')
                .setMinValues(0)
                .setMaxValues(options.length)
                .addOptions(options)
        );

        await message.channel.send({ embeds: [embed], components: [row] });
        await message.delete().catch(() => {});
    }
});

// معالج اختيار الأعضاء للرتب من المنيو المنسدل
client.on('interactionCreate', async interaction => {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'roles_select_menu') return;

    try {
        await interaction.deferReply({ ephemeral: true });

        const member = interaction.member;
        const selectedRoleIds = interaction.values;
        const data = loadData();

        for (const roleObj of data.roles) {
            const roleId = roleObj.id;
            const hasRole = member.roles.cache.has(roleId);
            const isSelected = selectedRoleIds.includes(roleId);

            if (isSelected && !hasRole) {
                await member.roles.add(roleId);
            } else if (!isSelected && hasRole) {
                await member.roles.add(roleId); // تم التصحيح لـ remove
                await member.roles.remove(roleId);
            }
        }

        await interaction.editReply({ content: '✅ تم تحديث رتبك بنجاح!' });
    } catch (err) {
        console.error(err);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: '❌ حدث خطأ، تأكد أن رتبة البوت أعلى من الرتب المراد إعطاؤها في إعدادات السيرفر.' }).catch(() => {});
        }
    }
});

// تشغيل البوت عبر متغير البيئة بأمان تام
client.login(process.env.TOKEN);