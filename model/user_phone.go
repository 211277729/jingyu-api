package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

var ErrPhoneAlreadyTaken = errors.New("Phone number is already in use")

// GetUserByPhone 根据手机号查询启用状态的用户。
func GetUserByPhone(phone string) (*User, error) {
	if phone == "" {
		return nil, errors.New("phone is empty")
	}
	var user User
	err := DB.Where("phone = ? AND status = ?", phone, common.UserStatusEnabled).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

// EnsurePhoneAvailable 校验手机号未被其他账号占用（可排除指定用户自身）。
func EnsurePhoneAvailable(phone string, userId int) error {
	if phone == "" {
		return errors.New("phone is empty")
	}
	var count int64
	query := DB.Model(&User{}).Where("phone = ?", phone)
	if userId > 0 {
		query = query.Where("id != ?", userId)
	}
	if err := query.Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return ErrPhoneAlreadyTaken
	}
	return nil
}

// BindUserPhone 为已登录用户绑定手机号。
func BindUserPhone(userId int, phone string) error {
	if err := EnsurePhoneAvailable(phone, userId); err != nil {
		return err
	}
	result := DB.Model(&User{}).Where("id = ?", userId).Update("phone", phone)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("user not found")
	}
	return nil
}
