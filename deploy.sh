#!/bin/bash
# 车辆预约系统 - GitHub Pages 部署脚本
# 使用方法：在 Git Bash 中运行 ./deploy.sh

echo "=========================================="
echo "  车辆预约系统 - GitHub Pages 部署脚本"
echo "=========================================="
echo ""

# 检查是否在项目目录
if [ ! -f "index.html" ]; then
    echo "错误：请在 vehicle-booking-system 目录下运行此脚本"
    exit 1
fi

# 获取 GitHub 用户名
read -p "请输入你的 GitHub 用户名: " USERNAME

if [ -z "$USERNAME" ]; then
    echo "错误：用户名不能为空"
    exit 1
fi

REPO_NAME="vehicle-booking-system"

echo ""
echo "即将创建仓库: $USERNAME/$REPO_NAME"
echo ""

# 初始化 Git 仓库
if [ ! -d ".git" ]; then
    echo ">>> 初始化 Git 仓库..."
    git init
fi

# 添加所有文件
echo ">>> 添加文件..."
git add index.html user.html schedule.html admin.html apps-script.js README.md

# 创建提交
echo ">>> 创建提交..."
git commit -m "Initial commit: 车辆预约排班系统"

# 创建 GitHub 仓库
echo ">>> 创建 GitHub 仓库..."
echo "请在浏览器中完成以下操作："
echo ""
echo "1. 打开 https://github.com/new"
echo "2. Repository name: $REPO_NAME"
echo "3. 选择 Public"
echo "4. 不要勾选 'Add a README file'"
echo "5. 点击 'Create repository'"
echo ""
read -p "完成后按回车继续..."

# 添加远程仓库
echo ">>> 添加远程仓库..."
git remote remove origin 2>/dev/null
git remote add origin https://github.com/$USERNAME/$REPO_NAME.git

# 推送代码
echo ">>> 推送代码到 GitHub..."
git branch -M main
git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "  部署成功！"
    echo "=========================================="
    echo ""
    echo "接下来请手动启用 GitHub Pages："
    echo ""
    echo "1. 打开 https://github.com/$USERNAME/$REPO_NAME/settings/pages"
    echo "2. Source 选择 'Deploy from a branch'"
    echo "3. Branch 选择 'main'，目录选择 '/ (root)'"
    echo "4. 点击 Save"
    echo ""
    echo "等待 1-2 分钟后，访问地址："
    echo "https://$USERNAME.github.io/$REPO_NAME/index.html"
    echo ""
else
    echo ""
    echo "推送失败，可能需要先登录 GitHub"
    echo "请运行: git config --global user.name \"你的名字\""
    echo "       git config --global user.email \"你的邮箱\""
    echo ""
    echo "如果使用 HTTPS 认证，可能需要输入 GitHub 用户名和密码"
    echo "如果使用 SSH，请确保已配置 SSH Key"
fi